from pydantic import BaseModel, ConfigDict

from app.db.models import Message


class MessageCreateSchema(BaseModel):
    chat_id: int
    sender_id: int | None
    content: str | None

class MessageFromDbSchema(MessageCreateSchema):
    model_config = ConfigDict(from_attributes=True)

    id: int

class MessageUpdateSchema(BaseModel):
    content: str | None

class MessageDeleteSchema(BaseModel):
    id: int

