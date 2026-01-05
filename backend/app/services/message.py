import logging

from app.app import schemas
from app.utils.unit_of_work import IUnitOfWork
from app.app.schemas.message import MessageCreateSchema, MessageFromDbSchema
from app.exceptions import InaccessibleEntity, UnfoundEntity
from app.utils.websocket import manager

logger = logging.getLogger(__name__)

class MessageService:
    def __init__(self, uow: IUnitOfWork):
        self.uow = uow

    async def get_one(self, pk: int):
        async with self.uow as uow:
            message = await uow.message.get_one(pk)
            message_for_return = MessageFromDbSchema.model_validate(message)

            return message_for_return

    async def create_message(self, *, chat_id: int, sender_id: int | None = None, data: str | None = None):
        async with self.uow as uow:
            chat = await uow.chat.get_one(pk=chat_id)
            if not chat:
                raise UnfoundEntity(detail="Чат не найден")

            if sender_id:
                user = await uow.user.get_one_by(id=sender_id)
                if not user:
                    raise UnfoundEntity(detail="Такого пользователя нет")

                is_user_in_chat = await uow.chat_participant.get_one_by(chat_id=chat_id, user_id=sender_id)

                if not is_user_in_chat:
                    raise InaccessibleEntity(
                        detail="Пользователь не состоит в чате"
                    )

            message = await uow.message.add_one({"chat_id":chat_id, 'sender_id':sender_id, 'content':data, 'file':None})
            message_for_return = MessageFromDbSchema.model_validate(message)
            await uow.commit()

            return message_for_return

    async def update(self, pk: int, data: schemas.MessageUpdateSchema):
        async with self.uow as uow:
            await uow.message.update(pk, data)
            message = await self.uow.message.get_one(pk)

            message_for_return = MessageFromDbSchema.model_validate(message)
            await uow.commit()

            return message_for_return