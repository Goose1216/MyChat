from uuid import UUID
from sqlalchemy import select, case
from sqlalchemy.orm import selectinload, joinedload

from .base import Repository
from app.db.models import Task, TaskAssignment, TaskStatus, TaskPriority

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

        #if assignee_id:
        #    stmt = stmt.join(TaskAssignment).where(
        #        TaskAssignment.user_id == assignee_id
        #    )

        status_order = case(
            (self.model.status == TaskStatus.NEW, 0),
            (self.model.status == TaskStatus.IN_PROGRESS, 1),
            (self.model.status == TaskStatus.DONE, 2),
            (self.model.status == TaskStatus.CANCELLED, 3),
            else_=100,
        )
        priority_order = case(
            (self.model.priority == TaskPriority.LOW, 0),
            (self.model.priority == TaskPriority.MEDIUM, 1),
            (self.model.priority == TaskPriority.HIGH, 2),
            (self.model.priority == TaskPriority.CRITICAL, 3),
            else_=100,
        )
        stmt = stmt.order_by(priority_order.desc())
        stmt = stmt.order_by(status_order, self.model.created_at.desc())

        stmt = stmt.limit(limit).offset(offset)

        result = await self.session.execute(stmt)
        return result.scalars().all()