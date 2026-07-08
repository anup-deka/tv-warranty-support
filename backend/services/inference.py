from openai import AsyncOpenAI
from backend.config import settings

_client: AsyncOpenAI | None = None


def get_inference_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.DO_INFERENCE_API_KEY,
            base_url=settings.DO_INFERENCE_BASE_URL,
        )
    return _client


async def embed_text(text: str) -> list[float]:
    """Embed a single text string using DO Serverless Inference."""
    client = get_inference_client()
    response = await client.embeddings.create(
        model=settings.DO_EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding


async def chat_completion(
    messages: list[dict],
    stream: bool = False,
    max_tokens: int = 1024,
    temperature: float = 0.3,
):
    """Call DO Serverless Inference LLM endpoint."""
    client = get_inference_client()
    return await client.chat.completions.create(
        model=settings.DO_LLM_MODEL,
        messages=messages,
        stream=stream,
        max_tokens=max_tokens,
        temperature=temperature,
    )
