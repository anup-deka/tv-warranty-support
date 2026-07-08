from datetime import date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.db.database import get_conn

router = APIRouter(prefix="/device", tags=["device"])


class DeviceResponse(BaseModel):
    serial_code: str
    customer_name: str
    customer_email: str
    tv_model: str
    tv_screen_size: str | None
    purchase_date: str
    warranty_expiry_date: str
    warranty_type: str
    retailer: str | None
    warranty_status: str        # active | expiring_soon | expired
    days_remaining: int         # negative if expired


def compute_warranty_status(expiry: date) -> tuple[str, int]:
    today = date.today()
    delta = (expiry - today).days
    if delta < 0:
        return "expired", delta
    elif delta <= 30:
        return "expiring_soon", delta
    else:
        return "active", delta


@router.get("/{serial_code}", response_model=DeviceResponse)
async def get_device(serial_code: str):
    async with get_conn() as conn:
        row = await conn.fetchrow(
            """
            SELECT serial_code, customer_name, customer_email,
                   tv_model, tv_screen_size, purchase_date,
                   warranty_expiry_date, warranty_type, retailer
            FROM devices
            WHERE serial_code = $1
            """,
            serial_code.upper(),
        )

    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No device found for serial code '{serial_code}'. "
                   "Please check the label on the back of your TV.",
        )

    status, days = compute_warranty_status(row["warranty_expiry_date"])

    return DeviceResponse(
        serial_code=row["serial_code"],
        customer_name=row["customer_name"],
        customer_email=row["customer_email"],
        tv_model=row["tv_model"],
        tv_screen_size=row["tv_screen_size"],
        purchase_date=row["purchase_date"].isoformat(),
        warranty_expiry_date=row["warranty_expiry_date"].isoformat(),
        warranty_type=row["warranty_type"],
        retailer=row["retailer"],
        warranty_status=status,
        days_remaining=days,
    )
