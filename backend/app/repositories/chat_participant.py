
from sqlalchemy import select, func

from .base import Repository
from app.db.models import Chat, ChatParticipant
from app.security import security

class ChatParticipantRepository(Repository):
    model = ChatParticipant

    async def get_max_other_read_id(self, chat_id: int) -> int:
        stmt = (
            select(func.max(self.model.last_read_message_id))
            .where(
                self.model.chat_id == chat_id,
            )
        )
        res = await self.session.execute(stmt)
        value = res.scalar()
        return int(value) if value is not None else 0