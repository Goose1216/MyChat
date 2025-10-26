from sqlalchemy import insert, select, update, delete, or_, and_

from .base import Repository
from app.db.models import Chat, ChatParticipant
from app.security import security

class ChatRepository(Repository):
    model = Chat

    async def get_all_for_user(self, user_id: int):
        stmt = (
            select(self.model)
            .join(ChatParticipant, self.model.id == ChatParticipant.chat_id)
            .where(ChatParticipant.user_id == user_id)
        )
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def get_one_for_user(self, chat_id: int, user_id: int):
        stmt = (
            select(self.model)
            .join(ChatParticipant, self.model.id == ChatParticipant.chat_id)
            .where(and_(ChatParticipant.user_id == user_id, ChatParticipant.chat_id == chat_id))
        )
        res = await self.session.execute(stmt)
        return res.scalars().one_or_none()