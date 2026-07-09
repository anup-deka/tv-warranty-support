"""
Startup database bootstrap. Runs on every deploy (from the app lifespan) and is
safe to re-run:

  - Schema: applied via CREATE ... IF NOT EXISTS (schema.sql).
  - Seed devices: applied via ON CONFLICT DO NOTHING (seed_devices.sql).
  - Policy ingest: only runs when the policy_chunks table is empty ("if not
    exists"), so we never re-embed on every boot.

A Postgres advisory lock guards the whole routine so multiple instances can't
race during a rolling deploy.
"""

import logging
import os
import re

import asyncpg

from config import settings
from db.database import get_pool
from services.inference import get_inference_client

logger = logging.getLogger("bootstrap")

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_REPO_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, ".."))

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")
SEED_PATH = os.path.join(_REPO_ROOT, "sample_data", "seed_devices.sql")
LOCAL_POLICY_PATH = os.path.join(_REPO_ROOT, "sample_data", "warranty_policy.txt")

CHUNK_SIZE_CHARS = 1800
CHUNK_OVERLAP_CHARS = 200
EMBED_BATCH_SIZE = 20

# Arbitrary, app-specific key so concurrent instances serialize bootstrap.
_ADVISORY_LOCK_KEY = 0x54565741  # "TVWA"


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


async def _apply_schema(conn: asyncpg.Connection) -> None:
    logger.info("Applying schema (idempotent)...")
    await conn.execute(_read(SCHEMA_PATH))


async def _apply_seed(conn: asyncpg.Connection) -> None:
    if not os.path.exists(SEED_PATH):
        logger.warning("Seed file not found at %s; skipping seed.", SEED_PATH)
        return
    logger.info("Seeding sample devices (idempotent)...")
    await conn.execute(_read(SEED_PATH))


def _load_policy_text() -> str | None:
    """Prefer DO Spaces; fall back to the local sample file."""
    if settings.DO_SPACES_KEY and settings.DO_SPACES_SECRET:
        try:
            import boto3
            from botocore.client import Config as BotoConfig

            s3 = boto3.client(
                "s3",
                region_name=settings.DO_SPACES_REGION,
                endpoint_url=settings.DO_SPACES_ENDPOINT,
                aws_access_key_id=settings.DO_SPACES_KEY,
                aws_secret_access_key=settings.DO_SPACES_SECRET,
                config=BotoConfig(signature_version="s3v4"),
            )
            obj = s3.get_object(
                Bucket=settings.DO_SPACES_BUCKET, Key=settings.DO_SPACES_POLICY_FILE
            )
            text = obj["Body"].read().decode("utf-8")
            logger.info("Loaded policy from Spaces (%d chars).", len(text))
            return text
        except Exception as exc:  # noqa: BLE001 - best-effort, fall back to local
            logger.warning("Spaces download failed (%s); trying local file.", exc)

    if os.path.exists(LOCAL_POLICY_PATH):
        text = _read(LOCAL_POLICY_PATH)
        logger.info("Loaded policy from local sample (%d chars).", len(text))
        return text

    logger.warning("No policy source available; skipping ingest.")
    return None


def _split_into_chunks(text: str) -> list[dict]:
    section_pattern = re.compile(r"^(SECTION \d+[:\s].+)$", re.MULTILINE)
    chunks: list[dict] = []
    chunk_index = 0

    boundaries = [(0, "Introduction")]
    for m in section_pattern.finditer(text):
        boundaries.append((m.start(), m.group(1).strip()))
    boundaries.append((len(text), None))

    for i, (start, section_title) in enumerate(boundaries[:-1]):
        end = boundaries[i + 1][0]
        section_text = text[start:end].strip()
        if not section_text:
            continue
        pos = 0
        while pos < len(section_text):
            chunk_text = section_text[pos : pos + CHUNK_SIZE_CHARS].strip()
            if chunk_text:
                chunks.append(
                    {
                        "section_title": section_title or "Introduction",
                        "content": chunk_text,
                        "chunk_index": chunk_index,
                    }
                )
                chunk_index += 1
            pos += CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS

    return chunks


async def _embed_chunks(chunks: list[dict]) -> list[dict]:
    client = get_inference_client()
    for i in range(0, len(chunks), EMBED_BATCH_SIZE):
        batch = chunks[i : i + EMBED_BATCH_SIZE]
        response = await client.embeddings.create(
            model=settings.DO_EMBEDDING_MODEL,
            input=[c["content"] for c in batch],
        )
        for j, emb in enumerate(response.data):
            batch[j]["embedding"] = emb.embedding
    return chunks


async def _ingest_policy_if_empty(conn: asyncpg.Connection) -> None:
    existing = await conn.fetchval("SELECT COUNT(*) FROM policy_chunks")
    if existing and existing > 0:
        logger.info("policy_chunks already populated (%d rows); skipping ingest.", existing)
        return

    text = _load_policy_text()
    if not text:
        return

    chunks = _split_into_chunks(text)
    if not chunks:
        logger.warning("Policy produced no chunks; skipping ingest.")
        return

    logger.info("Embedding %d policy chunks...", len(chunks))
    chunks = await _embed_chunks(chunks)

    async with conn.transaction():
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
    logger.info("Ingested %d policy chunks.", len(chunks))


async def bootstrap() -> None:
    """Idempotent startup bootstrap. Schema/seed are always applied; policy is
    ingested only when missing."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SELECT pg_advisory_lock($1)", _ADVISORY_LOCK_KEY)
        try:
            await _apply_schema(conn)
            try:
                await _apply_seed(conn)
            except Exception:  # noqa: BLE001 - seed is best-effort
                logger.exception("Seeding devices failed; continuing startup.")
            try:
                await _ingest_policy_if_empty(conn)
            except Exception:  # noqa: BLE001 - ingest is best-effort
                logger.exception("Policy ingest failed; continuing startup.")
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", _ADVISORY_LOCK_KEY)
