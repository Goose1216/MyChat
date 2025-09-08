from pydantic import BaseModel, ConfigDict
from typing import List

from app.db.models import ChatType, UserRole


class ChatCreateSchema(BaseModel):
    chat_type: ChatType
    user1_id: int
    user2_id: int
    title: str | None = None
    description: str | None = None


class ChatCreateSchemaForEndpoint(BaseModel):
    chat_type: ChatType
    user2_id: int
    title: str | None = None
    description: str | None = None


class ChatParticipantSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None
    user_id: int
    chat_id: int
    role: UserRole


class MessageSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int
    chat_id: int
    content: str | None


class ChatSchemaFromBd(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chat_type: ChatType
    title: str | None
    description: str | None
    participants: List[ChatParticipantSchema] = []
    messages: List[MessageSchema] = []
