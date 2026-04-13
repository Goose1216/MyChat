from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload

from .base import Repository
from app.db.models import Task, TaskAssignment

class TaskRepository(Repository):
    model = Task

    async def get_one_with_assignments(self, task_id: UUID) -> Task | None:
        stmt = (
            select(self.model)
            .where(self.model.id == task_id)
            .options(
                selectinload(self.model.assignments)
            )
        )

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_one_with_relations(self, task_id: UUID) -> Task | None:
        stmt = (
            select(self.model)
            .where(self.model.id == task_id)
            .options(
                joinedload(self.model.creator),
                joinedload(self.model.chat),
                selectinload(self.model.message),
                selectinload(self.model.assignments)
                    .selectinload("user")
            )
        )

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_with_filters(
            self,
            chat_id: int | None = None,
            creator_id: int | None = None,
            assignee_id: int | None = None,
            status=None,
            priority=None,
            limit: int = 20,
            offset: int = 0,
    ) -> list[Task]:

        stmt = select(self.model).options(
            joinedload(self.model.creator),
            joinedload(self.model.chat),
            selectinload(self.model.assignments).selectinload(TaskAssignment.user),
        )

        if chat_id:
            stmt = stmt.where(self.model.chat_id == chat_id)

        if creator_id:
            stmt = stmt.where(self.model.creator_id == creator_id)

        if status:
            stmt = stmt.where(self.model.status == status)

        if priority:
            stmt = stmt.where(self.model.priority == priority)

        if assignee_id:
            stmt = stmt.join(TaskAssignment).where(
                TaskAssignment.user_id == assignee_id
            )

        stmt = stmt.limit(limit).offset(offset)

        result = await self.session.execute(stmt)
        return result.scalars().all()