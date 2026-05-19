from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str = Field(default="")
    hashed_password: str
    role: str = Field(default="operator")   # "admin" | "operator" | "viewer"
    created_at: datetime = Field(default_factory=datetime.utcnow)
