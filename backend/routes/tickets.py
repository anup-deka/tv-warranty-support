import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.database import get_conn
from services.rag import generate_ticket_title

router = APIRouter(prefix="/tickets", tags=["tickets"])


class CreateTicketRequest(BaseModel):
    serial_code: str
    conversation_id: str
    description: str
    priority: str = "medium"   # low | medium | high | urgent


class TicketResponse(BaseModel):
    id: str
    serial_code: str
    conversation_id: str | None
    title: str
    description: str
    status: str
    priority: str
    created_at: str


class TicketListResponse(BaseModel):
    tickets: list[TicketResponse]


@router.post("", response_model=TicketResponse, status_code=201)
async def create_ticket(req: CreateTicketRequest):
    async with get_conn() as conn:
        # Verify device exists
        device = await conn.fetchrow(
            "SELECT serial_code FROM devices WHERE serial_code = $1",
            req.serial_code.upper(),
        )
        if not device:
            raise HTTPException(status_code=404, detail="Device not found.")

        # Fetch conversation history for AI title generation
        conv_row = await conn.fetchrow(
            "SELECT messages FROM conversations WHERE id = $1",
            req.conversation_id,
        )
        history = []
        if conv_row:
            msgs = conv_row["messages"]
            history = json.loads(msgs) if isinstance(msgs, str) else msgs

        # Generate a concise title using the LLM
        if history:
            title = await generate_ticket_title(history)
        else:
            title = req.description[:80]

        ticket_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        await conn.execute(
            """
            INSERT INTO tickets (id, serial_code, conversation_id, title, description, status, priority, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $7)
            """,
            ticket_id,
            req.serial_code.upper(),
            req.conversation_id,
            title,
            req.description,
            req.priority,
            now,
        )

    return TicketResponse(
        id=ticket_id,
        serial_code=req.serial_code.upper(),
        conversation_id=req.conversation_id,
        title=title,
        description=req.description,
        status="open",
        priority=req.priority,
        created_at=now.isoformat(),
    )


@router.get("/{serial_code}", response_model=TicketListResponse)
async def list_tickets(serial_code: str):
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT id, serial_code, conversation_id, title, description,
                   status, priority, created_at
            FROM tickets
            WHERE serial_code = $1
            ORDER BY created_at DESC
            """,
            serial_code.upper(),
        )

    return TicketListResponse(
        tickets=[
            TicketResponse(
                id=str(r["id"]),
                serial_code=r["serial_code"],
                conversation_id=str(r["conversation_id"]) if r["conversation_id"] else None,
                title=r["title"],
                description=r["description"],
                status=r["status"],
                priority=r["priority"],
                created_at=r["created_at"].isoformat(),
            )
            for r in rows
        ]
    )
