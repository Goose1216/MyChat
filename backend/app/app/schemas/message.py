from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime

from app.db.models import Message
from .users import UserSchemaFromBd
from .sql_to_pydantic import sqlalchemy_to_pydantic
from app.app.schemas import FileGettingFromDbSchema


class MessageCreateSchema(BaseModel):
    chat_id: int
    sender_id: int | None
    content: str | None


class MessageFromDbSchema(MessageCreateSchema):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    sender: UserSchemaFromBd | None = None
    file: FileGettingFromDbSchema | None = None
    is_deleted: bool

    _convert_user = field_validator("sender", mode="before")(sqlalchemy_to_pydantic(UserSchemaFromBd))
    _convert_file = field_validator("file", mode="before")(sqlalchemy_to_pydantic(FileGettingFromDbSchema))


class MessageUpdateSchema(BaseModel):
    content: str | None = None


class MessageDeleteSchema(BaseModel):
    id: int

