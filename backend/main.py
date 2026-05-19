import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from core.config import settings
from models.db import create_db
from models.user import User   # ensure User table is created
from routers.chat import router as chat_router
from routers.metrics import router as metrics_router
from routers.auth import router as auth_router
from simulations.engine import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    create_db()
    # Start simulation engine background loop
    sim_task = asyncio.create_task(engine.run(interval=0.5))
    yield
    # Shutdown
    sim_task.cancel()


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ARIA Core API",
    version="1.0.0",
    description="Smart server room AI agent backend",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow Vercel preview URLs + localhost dev
origins = [o.strip() for o in settings.cors_origins.split(",")]
origins += ["https://*.vercel.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(metrics_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ARIA Core API"}


@app.get("/")
async def root():
    return {
        "name": "ARIA Core API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
