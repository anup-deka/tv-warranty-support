#!/usr/bin/env python3
"""
One-time script to ingest the warranty policy document into PostgreSQL pgvector.

Steps:
  1. Download warranty_policy.txt from DO Spaces (or use local file as fallback)
  2. Split it into ~500-token chunks, preserving section boundaries
  3. Embed each chunk via DO Serverless Inference embedding model
  4. Upsert chunks into the policy_chunks table

Usage:
  cd tv-warranty-support
  pip install -r backend/requirements.txt
  cp backend/.env.example backend/.env   # fill in your values
  python scripts/ingest_policy.py [--local]

Flags:
  --local   Use sample_data/warranty_policy.txt instead of downloading from Spaces
"""

import argparse
import asyncio
import os
import re
import sys
import asyncpg
import boto3
from botocore.client import Config
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../backend/.env"))

DO_INFERENCE_BASE_URL = os.environ["DO_INFERENCE_BASE_URL"]
DO_INFERENCE_API_KEY = os.environ["DO_INFERENCE_API_KEY"]
DO_EMBEDDING_MODEL = os.environ.get("DO_EMBEDDING_MODEL", "text-embedding-ada-002")
DATABASE_URL = os.environ["DATABASE_URL"]
DO_SPACES_KEY = os.environ.get("DO_SPACES_KEY", "")
DO_SPACES_SECRET = os.environ.get("DO_SPACES_SECRET", "")
DO_SPACES_REGION = os.environ.get("DO_SPACES_REGION", "nyc3")
DO_SPACES_BUCKET = os.environ.get("DO_SPACES_BUCKET", "tv-warranty-policies")
DO_SPACES_ENDPOINT = os.environ.get("DO_SPACES_ENDPOINT", "https://nyc3.digitaloceanspaces.com")
DO_SPACES_POLICY_FILE = os.environ.get("DO_SPACES_POLICY_FILE", "warranty_policy.txt")

CHUNK_SIZE_CHARS = 1800   # ~450 tokens at ~4 chars/token
CHUNK_OVERLAP_CHARS = 200


def download_from_spaces() -> str:
    """Download policy document from DO Spaces."""
    print(f"Downloading {DO_SPACES_POLICY_FILE} from DO Spaces bucket {DO_SPACES_BUCKET}...")
    s3 = boto3.client(
        "s3",
        region_name=DO_SPACES_REGION,
        endpoint_url=DO_SPACES_ENDPOINT,
        aws_access_key_id=DO_SPACES_KEY,
        aws_secret_access_key=DO_SPACES_SECRET,
        config=Config(signature_version="s3v4"),
    )
    response = s3.get_object(Bucket=DO_SPACES_BUCKET, Key=DO_SPACES_POLICY_FILE)
    text = response["Body"].read().decode("utf-8")
    print(f"Downloaded {len(text)} characters.")
    return text


def load_local_file() -> str:
    """Load policy document from local sample_data directory."""
    local_path = os.path.join(os.path.dirname(__file__), "../sample_data/warranty_policy.txt")
    print(f"Loading local file: {local_path}")
    with open(local_path, encoding="utf-8") as f:
        return f.read()


def split_into_chunks(text: str) -> list[dict]:
    """
    Split text into overlapping chunks, preserving SECTION headers as metadata.
    Returns a list of {"section_title": str, "content": str, "chunk_index": int}
    """
    # Detect section headers like "SECTION 3: WHAT IS COVERED"
    section_pattern = re.compile(r"^(SECTION \d+[:\s].+)$", re.MULTILINE)

    chunks = []
    current_section = "Introduction"
    chunk_index = 0

    # Walk through section boundaries first
    section_matches = list(section_pattern.finditer(text))
    boundaries = [(0, "Introduction")]
    for m in section_matches:
        boundaries.append((m.start(), m.group(1).strip()))
    boundaries.append((len(text), None))

    for i, (start, section_title) in enumerate(boundaries[:-1]):
        end = boundaries[i + 1][0]
        section_text = text[start:end].strip()
        if not section_text:
            continue

        # Further split large sections into overlapping chunks
        pos = 0
        while pos < len(section_text):
            chunk_text = section_text[pos: pos + CHUNK_SIZE_CHARS].strip()
            if chunk_text:
                chunks.append({
                    "section_title": section_title or current_section,
                    "content": chunk_text,
                    "chunk_index": chunk_index,
                })
                chunk_index += 1
            pos += CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS

    print(f"Split document into {len(chunks)} chunks.")
    return chunks


async def embed_chunks(chunks: list[dict]) -> list[dict]:
    """Embed all chunks using DO Serverless Inference embedding endpoint."""
    client = AsyncOpenAI(
        api_key=DO_INFERENCE_API_KEY,
        base_url=DO_INFERENCE_BASE_URL,
    )

    print(f"Embedding {len(chunks)} chunks via DO Inference ({DO_EMBEDDING_MODEL})...")
    batch_size = 20
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i: i + batch_size]
        texts = [c["content"] for c in batch]
        response = await client.embeddings.create(model=DO_EMBEDDING_MODEL, input=texts)
        for j, emb in enumerate(response.data):
            batch[j]["embedding"] = emb.embedding
        print(f"  Embedded {min(i + batch_size, len(chunks))}/{len(chunks)} chunks")

    return chunks


async def upsert_chunks(chunks: list[dict]) -> None:
    """Clear existing policy chunks and insert fresh ones."""
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    try:
        await conn.execute("TRUNCATE TABLE policy_chunks RESTART IDENTITY")
        print("Cleared existing policy_chunks.")

        for chunk in chunks:
            embedding_str = "[" + ",".join(str(x) for x in chunk["embedding"]) + "]"
            await conn.execute(
                """
                INSERT INTO policy_chunks (section_title, content, embedding, chunk_index)
                VALUES ($1, $2, $3::vector, $4)
                """,
                chunk["section_title"],
                chunk["content"],
                embedding_str,
                chunk["chunk_index"],
            )

        print(f"Inserted {len(chunks)} chunks into policy_chunks.")
    finally:
        await conn.close()


async def main(use_local: bool) -> None:
    text = load_local_file() if use_local else download_from_spaces()
    chunks = split_into_chunks(text)
    chunks = await embed_chunks(chunks)
    await upsert_chunks(chunks)
    print("Policy ingestion complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest warranty policy into pgvector")
    parser.add_argument("--local", action="store_true", help="Use local sample file instead of Spaces")
    args = parser.parse_args()
    asyncio.run(main(use_local=args.local))
