from db.database import get_conn
from services.inference import embed_text, chat_completion

SYSTEM_PROMPT = """You are a helpful TV warranty support assistant for VistaTech Electronics.
Your job is to help customers understand their warranty coverage and resolve issues.

You have access to relevant sections of the official VistaTech Warranty Policy below.
Always ground your answers in the policy content provided. Be clear, concise, and empathetic.

If a customer's question cannot be answered from the provided policy context, say so honestly
and suggest they contact VistaTech support directly at 1-800-VISTA-TV.

Do NOT invent policy details that are not in the provided context.
"""


async def search_policy_chunks(query: str, top_k: int = 5) -> list[dict]:
    """Embed query and retrieve top-k similar policy chunks from pgvector."""
    embedding = await embed_text(query)
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT id, section_title, content,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM policy_chunks
            ORDER BY embedding <=> $1::vector
            LIMIT $2
            """,
            embedding_str,
            top_k,
        )
    return [dict(r) for r in rows]


async def build_rag_response(
    question: str,
    device_context: dict,
    conversation_history: list[dict],
) -> str:
    """Run the full RAG pipeline: retrieve policy chunks → build prompt → call LLM."""
    chunks = await search_policy_chunks(question)

    policy_context = "\n\n".join(
        f"[{c['section_title']}]\n{c['content']}" for c in chunks
    )

    device_info = (
        f"Customer: {device_context['customer_name']}\n"
        f"TV Model: {device_context['tv_model']} ({device_context.get('tv_screen_size', 'N/A')})\n"
        f"Serial Code: {device_context['serial_code']}\n"
        f"Purchase Date: {device_context['purchase_date']}\n"
        f"Warranty Expiry: {device_context['warranty_expiry_date']}\n"
        f"Warranty Type: {device_context['warranty_type']}\n"
        f"Warranty Status: {device_context['warranty_status']}"
    )

    system_message = (
        f"{SYSTEM_PROMPT}\n\n"
        f"--- CUSTOMER DEVICE INFORMATION ---\n{device_info}\n\n"
        f"--- RELEVANT WARRANTY POLICY SECTIONS ---\n{policy_context}"
    )

    messages = [{"role": "system", "content": system_message}]
    for msg in conversation_history[-8:]:  # keep last 8 turns for context
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})

    response = await chat_completion(messages, temperature=0.3, max_tokens=1024)
    return response.choices[0].message.content


async def generate_ticket_title(conversation_messages: list[dict]) -> str:
    """Use LLM to generate a concise ticket title from the conversation."""
    transcript = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in conversation_messages[-6:]
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are a support ticket assistant. Given a customer support conversation, "
                "generate a concise support ticket title (max 10 words) that describes the "
                "customer's issue. Output only the title, nothing else."
            ),
        },
        {"role": "user", "content": f"Conversation:\n{transcript}\n\nTicket title:"},
    ]
    response = await chat_completion(messages, temperature=0.1, max_tokens=30)
    return response.choices[0].message.content.strip().strip('"')
