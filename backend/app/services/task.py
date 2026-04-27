import logging
from uuid import UUID

from app.utils.unit_of_work import IUnitOfWork
from app.db.models import Task, TaskAssignment
from app.app.schemas.task import (
    TaskCreateSchema,
    TaskUpdateSchema,
    TaskFromDbSchema,
    TaskAssignmentStatusUpdateSchema,
)
from app.exceptions import (
    UnfoundEntity,
    DuplicateEntity,
    UnprocessableEntity,
)

logger = logging.getLogger(__name__)

class TaskService:
    def __init__(self, uow: IUnitOfWork):
        self.uow = uow

    async def list_tasks(
            self,
            chat_id: int | None = None,
            creator_id: int | None = None,
            assignee_id: int | None = None,
            status=None,
            priority=None,
            limit: int = 20,
            offset: int = 0,
    ) -> list[TaskFromDbSchema]:

        async with self.uow as uow:
            tasks = await uow.task.list_with_filters(
                chat_id=chat_id,
                creator_id=creator_id,
                assignee_id=assignee_id,
                status=status,
                priority=priority,
                limit=limit,
                offset=offset,
            )

            return [
                TaskFromDbSchema.model_validate(t)
                for t in tasks
            ]

    async def create_task(self, task: TaskCreateSchema) -> TaskFromDbSchema:
        task_data = task.model_dump()
        assignee_ids = set(task_data.pop("assignee_ids"))

        if not assignee_ids:
            raise UnprocessableEntity(detail="Задача должна иметь хотя бы одного исполнителя")

        async with self.uow as uow:
            creator = await uow.user.get_one(pk=task_data["creator_id"])
            if not creator:
                raise UnfoundEntity(detail="Создатель задачи не найден")

            if task_data.get("chat_id"):
                user_in_chat = await uow.chat_participant.get_by(chat_id=task_data["chat_id"], user_id=task_data["creator_id"])
                if not user_in_chat:
                    raise UnfoundEntity(detail="Пользователь не состоит в чате")

            if task_data.get("message_id"):
                message = await uow.message.get_one(pk=task_data["message_id"])
                if not message:
                    raise UnfoundEntity(detail="Сообщение не найдено")

            task_created = await uow.task.add_one(task_data)
            for user_id in assignee_ids:
                user = await uow.user.get_one(pk=user_id)
                if not user:
                    raise UnfoundEntity(detail=f"Пользователь {user_id} не найден")

                await uow.task_assignment.add_one(
                    {
                        "task_uuid": task_created.id,
                        "user_id": user_id,
                    }
                )
            await uow.session.flush()

            await uow.session.refresh(task_created, ["assignments"])
            task_for_return = TaskFromDbSchema.model_validate(task_created)
            await uow.commit()

            return task_for_return

    async def update_task(self, task_id: UUID, task_update: TaskUpdateSchema, user_id: int) -> TaskFromDbSchema:
        update_data = task_update.model_dump(exclude_unset=True)

        async with self.uow as uow:
            task = await uow.task.get_one(pk=task_id)

            assignment = await uow.task_assignment.get_by(
                task_uuid=task_id,
                user_id=user_id,
            )

            if not assignment and not task.creator_id == user_id:
                raise UnprocessableEntity(detail="Нет прав на изменение задачи")
            if not task:
                raise UnfoundEntity(detail="Задача не найдена")

            await uow.task.update(pk=task_id, data=update_data)

            await uow.commit()
            task_new = await uow.task.get_one(pk=task_id)

            return TaskFromDbSchema.model_validate(task_new)

    async def delete_task(self, task_id: UUID) -> None:
        async with self.uow as uow:
            task = await uow.task.get_one(pk=task_id)
            if not task:
                raise UnfoundEntity(detail="Задача не найдена")

            await uow.task.delete(task_id)
            await uow.commit()

    async def get_task(self, task_id: UUID) -> TaskFromDbSchema:
        async with self.uow as uow:
            task = await uow.task.get_one_with_relations(task_id)
            if not task:
                raise UnfoundEntity(detail="Задача не найдена")

            return TaskFromDbSchema.model_validate(task)

    async def get_tasks_stats(self, chat_id: int | None = None):
        async with self.uow:
            return await self.uow.task.get_stats(chat_id=chat_id)