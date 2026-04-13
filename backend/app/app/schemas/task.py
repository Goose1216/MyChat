from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from uuid import UUID
from typing import List

from app.db.models import TaskStatus, TaskPriority
from .users import UserSchemaFromBd
from .sql_to_pydantic import sqlalchemy_to_pydantic


class TaskCreateSchemaForEndpoint(BaseModel):
    title: str
    description: str | None = None
    chat_id: int | None = None
    message_id: int | None = None
    priority: TaskPriority = TaskPriority.LOW
    assignee_ids: List[int]


class TaskCreateSchema(TaskCreateSchemaForEndpoint):
    creator_id: int


class TaskUpdateSchema(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None


class TaskFromDbSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    priority: TaskPriority
    status: TaskStatus
    creator_id: int | None
    chat_id: int | None
    message_id: int | None
    created_at: datetime
    updated_at: datetime

    creator: UserSchemaFromBd | None = None

    _convert_creator = field_validator("creator", mode="before")(
        sqlalchemy_to_pydantic(UserSchemaFromBd)
    )


class TaskAssignmentCreateSchema(BaseModel):
    task_id: UUID
    user_id: int


class TaskAssignmentStatusUpdateSchema(BaseModel):
    task_id: UUID
    user_id: int
    status: TaskStatus


class TaskAssignmentFromDbSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_uuid: UUID
    user_id: int
    status: TaskStatus

    user: UserSchemaFromBd | None = None

    _convert_user = field_validator("user", mode="before")(
        sqlalchemy_to_pydantic(UserSchemaFromBd)
    )