from pydantic import BaseModel, ConfigDict, model_validator
from typing import List

from app.db.models import ChatType, UserRole


class ChatCreateSchema(BaseModel):
    chat_type: ChatType
    user_id: int
    title: str | None = None
    description: str | None = None


class ChatCreateSchemaForEndpoint(BaseModel):
    chat_type: ChatType
    user2_id: int | None = None
    title: str | None = None
    description: str | None = None


class ChatPrivateCreateSchema(BaseModel):
    chat_id: int
    user1_id: int
    user2_id: int

    @model_validator(mode='before')
    def ensure_user1_id_less_than_user2_id(cls, data):
        user1 = data.get('user1_id')
        user2 = data.get('user2_id')
        if user1 is not None and user2 is not None and user1 > user2:
            data['user1_id'], data['user2_id'] = user2, user1
        return data


class ChatParticipantSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    user_id: int
    chat_id: int
    role: UserRole


class ChatParticipantSchemaForAddUser(BaseModel):
    user_id: int
    chat_id: int


class MessageSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int
    chat_id: int
    content: str | None = None


class ChatSchemaFromBd(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chat_type: ChatType
    title: str | None = None
    description: str | None = None

