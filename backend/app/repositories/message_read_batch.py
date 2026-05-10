from datetime import datetime, timezone

from sqlalchemy import select, and_, func

from .base import Repository
from app.db.models import MessageReadBatch


class MessageReadBatchRepository(Repository):
    model = MessageReadBatch

    async def create_batch(
        self,
        user_id: int,
        chat_id: int,
        from_id: int,
        to_id: int,
    ) -> MessageReadBatch:
        """
        Создаёт запись о прочтении диапазона сообщений [from_id, to_id].
        Вызывается с фронта раз в N минут.
        """
        obj = self.model(
            user_id=user_id,
            chat_id=chat_id,
            from_id=from_id,
            to_id=to_id,
            read_at=datetime.now(timezone.utc),
        )
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def get_readers_for_message(
        self,
        chat_id: int,
        message_id: int,
        exclude_user_id: int,
    ) -> list:
        """
        Возвращает список (user_id, earliest_read_at) для всех пользователей
        которые прочитали сообщение message_id в чате chat_id.

        Логика: ищем батчи где from_id <= message_id <= to_id.
        Берём самый ранний read_at на пользователя — это момент когда
        сообщение впервые попало в батч прочтения (с погрешностью до N минут).
        """
        stmt = (
            select(
                self.model.user_id,
                func.min(self.model.read_at).label('read_at'),
            )
            .where(
                and_(
                    self.model.chat_id == chat_id,
                    self.model.from_id <= message_id,
                    self.model.to_id   >= message_id,
                    self.model.user_id != exclude_user_id,
                )
            )
            .group_by(self.model.user_id)
            .order_by(func.min(self.model.read_at))
        )

        res = await self.session.execute(stmt)
        return res.all()  # list of Row(user_id, read_at)