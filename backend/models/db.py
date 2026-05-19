from sqlmodel import SQLModel, Field, create_engine, Session
from typing import Optional
from datetime import datetime
from core.config import settings

class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    role: str  # user | aria
    content: str
    mood: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ToolEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str
    tool_name: str
    tool_args: str
    tool_result: Optional[str] = None
    approved: Optional[bool] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ServerEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scenario: str
    severity: str
    node: str
    metric: str
    value: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
)

def create_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
