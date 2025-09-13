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

    @model_validator(mode='before')
    def check_user2_id(cls, data):
        chat_type = data.get('chat_type')
        user2_id = data.get('user2_id')
        if chat_type == ChatType.PRIVATE and user2_id is None:
            raise ValueError('user2_id must be provided for private chats')
        if chat_type != ChatType.PRIVATE and user2_id is not None:
            raise ValueError('user2_id should be None for non-private chats')
        return data

    @model_validator(mode='before')
    def check_title(cls, data):
        title = data.get("title")
        chat_type = data.get('chat_type')
        if title is None and chat_type != ChatType.PRIVATE:
            raise ValueError('need title for not private chat')
        return data

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

