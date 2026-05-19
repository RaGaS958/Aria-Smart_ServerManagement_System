import os
import pathlib
from pydantic_settings import BaseSettings, SettingsConfigDict

# ── Find .env file regardless of working directory ────────────────────────────
# Looks in: backend/ → project root → user home
def _find_env() -> str:
    candidates = [
        pathlib.Path(__file__).parent.parent / ".env",   # backend/.env  ← correct
        pathlib.Path(__file__).parent.parent.parent / ".env",  # project root
        pathlib.Path.cwd() / ".env",                      # wherever uvicorn runs from
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return ".env"   # fallback, let pydantic handle the missing file gracefully

_ENV_FILE = _find_env()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    mistral_api_key:      str  = "sk-placeholder"
    openweather_api_key:  str  = ""
    tavily_api_key:       str  = ""
    redis_url:            str  = "redis://localhost:6379"
    database_url:         str  = "sqlite:///./aria.db"
    cors_origins:         str  = "http://localhost:5173,http://localhost:3000"
    sim_mode:             bool = True

settings = Settings()

# ── Startup key check (printed once when server starts) ───────────────────────
def _mask(val: str) -> str:
    if not val or val == "sk-placeholder":
        return "❌  NOT SET"
    return val[:10] + "..." + val[-4:] if len(val) > 14 else "✓ set"

print(f"\n┌─ ARIA env loaded from: {_ENV_FILE}")
print(f"│  MISTRAL_API_KEY     : {_mask(settings.mistral_api_key)}")
print(f"│  OPENWEATHER_API_KEY : {_mask(settings.openweather_api_key) if settings.openweather_api_key else '(optional, not set)'}")
print(f"│  TAVILY_API_KEY      : {_mask(settings.tavily_api_key) if settings.tavily_api_key else '(optional, not set)'}")
print(f"└────────────────────────────────────────\n")