from sqlalchemy import insert, select, update, delete, or_, and_

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