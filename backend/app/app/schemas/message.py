from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime

from app.db.models import MessageStatus
from .users import UserSchemaFromBd
from .sql_to_pydantic import sqlalchemy_to_pydantic


class MessageCreateSchema(BaseModel):
    chat_id: int
    sender_id: int | None
    content: str | None


class MessageFromDbSchema(MessageCreateSchema):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    sender: UserSchemaFromBd
    status: MessageStatus

    _convert_user = field_validator("sender", mode="before")(sqlalchemy_to_pydantic(UserSchemaFromBd))


class MessageUpdateSchema(BaseModel):
    content: str | None = None
    status: MessageStatus | None = None


class MessageDeleteSchema(BaseModel):
    id: int

