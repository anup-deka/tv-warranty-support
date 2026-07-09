from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.bootstrap import bootstrap
from db.database import close_pool, get_pool
from routes import chat, device, tickets


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    await bootstrap()
    yield
    await close_pool()


app = FastAPI(
    title="TV Warranty Support API",
    description="Warranty Q&A and support ticketing for VistaTech TVs",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(device.router)
app.include_router(chat.router)
app.include_router(tickets.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
