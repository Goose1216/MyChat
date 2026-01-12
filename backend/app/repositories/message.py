from sqlalchemy import insert, select, update, delete, or_, and_, func

from .base import Repository
from app.db.models import Message

class MessageRepository(Repository):
    model = Message

    async def get_all_for_chat(self, chat_id: int):
        stmt = (
            select(self.model)
            .where(self.model.chat_id == chat_id)
            .order_by(self.model.created_at)
        )
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def get_last_for_chat(self, chat_id: int):
        stmt = (
            select(self.model)
            .where(self.model.chat_id == chat_id, self.model.is_deleted == False)
            .order_by(self.model.created_at.desc())
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_unread_count(self, last_read_message_id: int, user_id: int, chat_id: int):
        stmt = (
            select(func.count())
            .select_from(self.model)
            .where(
                self.model.chat_id == chat_id,
                self.model.id > last_read_message_id,
                self.model.sender_id != user_id,
                self.model.is_deleted.is_(False),
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one()