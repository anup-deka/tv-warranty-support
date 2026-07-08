import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.db.database import get_conn
from backend.routes.device import compute_warranty_status
from backend.services.rag import build_rag_response

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    serial_code: str
    message: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    serial_code: str


async def _get_device_context(conn, serial_code: str) -> dict:
    row = await conn.fetchrow(
        """
        SELECT serial_code, customer_name, customer_email,
               tv_model, tv_screen_size, purchase_date,
               warranty_expiry_date, warranty_type
        FROM devices WHERE serial_code = $1
        """,
        serial_code.upper(),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Device not found for this serial code.")

    status, days = compute_warranty_status(row["warranty_expiry_date"])
    ctx = dict(row)
    ctx["warranty_status"] = status
    ctx["days_remaining"] = days
    ctx["purchase_date"] = row["purchase_date"].isoformat()
    ctx["warranty_expiry_date"] = row["warranty_expiry_date"].isoformat()
    return ctx


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    async with get_conn() as conn:
        device_ctx = await _get_device_context(conn, req.serial_code)

        # Fetch or create conversation
        if req.conversation_id:
            row = await conn.fetchrow(
                "SELECT id, messages FROM conversations WHERE id = $1 AND serial_code = $2",
                req.conversation_id,
                req.serial_code.upper(),
            )
            if not row:
                raise HTTPException(status_code=404, detail="Conversation not found.")
            conv_id = str(row["id"])
            history: list[dict] = json.loads(row["messages"]) if isinstance(row["messages"], str) else row["messages"]
        else:
            conv_id = str(uuid.uuid4())
            history = []
            await conn.execute(
                "INSERT INTO conversations (id, serial_code, messages) VALUES ($1, $2, $3::jsonb)",
                conv_id,
                req.serial_code.upper(),
                json.dumps(history),
            )

        # Run RAG pipeline
        answer = await build_rag_response(req.message, device_ctx, history)

        # Append both turns to conversation history
        history.append({"role": "user", "content": req.message})
        history.append({"role": "assistant", "content": answer})

        now = datetime.now(timezone.utc)
        await conn.execute(
            """
            UPDATE conversations
            SET messages = $1::jsonb, updated_at = $2
            WHERE id = $3
            """,
            json.dumps(history),
            now,
            conv_id,
        )

    return ChatResponse(
        conversation_id=conv_id,
        answer=answer,
        serial_code=req.serial_code.upper(),
    )
