import logging
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, Query

from app.services.task import TaskService
from app.app import schemas
from app.app.schemas.task import (
    TaskCreateSchema,
    TaskUpdateSchema,
    TaskFromDbSchema,
    TaskAssignmentStatusUpdateSchema,
    TaskCreateSchemaForEndpoint,
)
from app.app.schemas.response import Response
from app.utils.response import get_responses_description_by_codes
from app.utils import get_unit_of_work
from app.utils.unit_of_work import IUnitOfWork
from app.security import security
from app.exceptions import NotAuthenticated

logger = logging.getLogger(__name__)

tasks = APIRouter(
    tags=["Задачи"],
    prefix="/tasks",
)

@tasks.get(
    "/",
    response_model=Response[List[TaskFromDbSchema]],
    name="Список задач",
    responses=get_responses_description_by_codes([401]),
)
async def list_tasks(
    access_token=Depends(security.decode_jwt_access),
    uow: IUnitOfWork = Depends(get_unit_of_work),

    chat_id: int | None = Query(None),
    creator_id: int | None = Query(None),
    assignee_id: int | None = Query(None),
    #status: str | None = Query(None),
    priority: str | None = Query(None),

    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    service = TaskService(uow)

    tasks = await service.list_tasks(
        chat_id=chat_id,
        creator_id=creator_id,
        assignee_id=assignee_id,
        #status=status,
        priority=priority,
        limit=limit,
        offset=offset,
    )

    return Response(data=tasks)

@tasks.post(
    "/",
    response_model=Response[TaskFromDbSchema],
    name="Создать задачу",
    responses=get_responses_description_by_codes([401, 404, 422])
)
async def create_task(
    task_data: TaskCreateSchemaForEndpoint,
    access_token=Depends(security.decode_jwt_access),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    user_id = access_token.get("user_id")

    # принудительно ставим creator_id из токена
    task_dict = task_data.model_dump()
    task_dict["creator_id"] = user_id

    task_schema = TaskCreateSchema.model_validate(task_dict)

    service = TaskService(uow)
    task = await service.create_task(task_schema)

    return Response(data=task)

@tasks.get(
    "/{task_id}/",
    response_model=Response[TaskFromDbSchema],
    name="Получить задачу",
    responses=get_responses_description_by_codes([401, 404])
)
async def get_task(
    task_id: UUID,
    access_token=Depends(security.decode_jwt_access),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    service = TaskService(uow)
    task = await service.get_task(task_id)
    return Response(data=task)

@tasks.patch(
    "/{task_id}/",
    response_model=Response[TaskFromDbSchema],
    name="Обновить задачу",
    responses=get_responses_description_by_codes([401, 404])
)
async def update_task(
    task_id: UUID,
    task_update: TaskUpdateSchema,
    access_token=Depends(security.decode_jwt_access),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    service = TaskService(uow)
    updated_task = await service.update_task(task_id, task_update, access_token.get("user_id"))
    return Response(data=updated_task)

@tasks.delete(
    "/{task_id}/",
    response_model=Response[None],
    name="Удалить задачу",
    responses=get_responses_description_by_codes([401, 404])
)
async def delete_task(
    task_id: UUID,
    access_token=Depends(security.decode_jwt_access),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    service = TaskService(uow)
    await service.delete_task(task_id)
    return Response(data=None)

@tasks.put(
    "/{task_id}/assignments/",
    response_model=Response[None],
    name="Обновить исполнителей задачи",
    responses=get_responses_description_by_codes([401, 404, 422])
)
async def update_assignments(
    task_id: UUID,
    assignee_ids: List[int] = Query(...),
    access_token=Depends(security.decode_jwt_access),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    service = TaskService(uow)
    await service.update_assignments(task_id, assignee_ids)
    return Response(data=None)

@tasks.patch(
    "/assignments/status/",
    response_model=Response[None],
    name="Обновить статус назначения",
    responses=get_responses_description_by_codes([401, 404])
)
async def update_assignment_status(
    data: TaskAssignmentStatusUpdateSchema,
    access_token=Depends(security.decode_jwt_access),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    service = TaskService(uow)
    await service.update_assignment_status(data)
    return Response(data=None)

