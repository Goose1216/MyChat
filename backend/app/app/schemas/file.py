from pydantic import BaseModel, ConfigDict, model_serializer

from app.db.models import  File


class FileBaseSchema(BaseModel):
    url: str
    message_id: int | None = None
    filename: str | None = None


class FileCreateSchema(FileBaseSchema):
    path: str | None = None


class FileGettingFromDbSchema(FileBaseSchema):
    model_config = ConfigDict(from_attributes=True)

    id: int


class FileGettingFromDbWithPathSchema(FileBaseSchema):
    model_config = ConfigDict(from_attributes=True)

    path: str
    id: int