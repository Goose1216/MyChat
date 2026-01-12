import logging
from sqlalchemy.exc import IntegrityError

from app.utils.unit_of_work import IUnitOfWork
from app.app.schemas.users import UserSchemaRegister, UserSchemaFromBd
from app.app.schemas.chats import (ChatCreateSchema, ChatParticipantSchema,
                                   ChatSchemaFromBd, ChatPrivateCreateSchema, ChatParticipantSchemaForAddUser,
                                   ChatSchemaFromBdWithLastMessage)
from app.app.schemas.message import MessageFromDbSchema
from app.db.models import ChatType, Message, Chat, ChatParticipant
from app.exceptions import NotAuthenticated, InaccessibleEntity, UnprocessableEntity, EntityError, DuplicateEntity, UnfoundEntity

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self, uow: IUnitOfWork):
        self.uow = uow

    async def create_chat(self, chat: ChatCreateSchema, user2_id: int | None = None):
        chat_create_data = chat.model_dump()
        user_id = chat_create_data.pop("user_id")

        async with self.uow as uow:
            chat_created = await uow.chat.add_one(chat_create_data)
            chat_for_return = ChatSchemaFromBd.model_validate(chat_created)
            chat_id = chat_for_return.id

            if chat_for_return.chat_type == ChatType.PRIVATE:
                if user2_id:
                    user2 = await uow.user.get_one(pk=user2_id)
                    if user2 is None:
                        raise UnprocessableEntity(
                            detail="Пользователя нет"
                        )
                else:
                    raise UnprocessableEntity(
                        detail="Не указан второй пользователь"
                    )

                chat_participant = await uow.chat_private.get_one_by(
                    user1_id=min(user_id, user2_id),
                    user2_id=max(user_id, user2_id)
                )
                if chat_participant is not None:
                    raise DuplicateEntity(
                        detail="Такой чат уже есть"
                    )

                # Используем min и max для легкости поиска этого чата в будущем, т.к. user1_id < user2_id
                data_for_create_private_chat = {
                    "chat_id": chat_id,
                    "user1_id": min(user_id, user2_id),
                    "user2_id": max(user_id, user2_id),
                }
                ChatPrivateCreateSchema.model_validate(data_for_create_private_chat)

                await uow.chat_private.add_one(data_for_create_private_chat)

                chat_participant2 = await uow.chat_participant.add_one({"user_id": user2_id, "chat_id": chat_id})

            chat_participant1 = await uow.chat_participant.add_one({"user_id": user_id, "chat_id": chat_id})
            await uow.commit()
            return chat_for_return


    async def add_user_in_chat(self, user_who_add_id: int, info: ChatParticipantSchemaForAddUser):
        info_for_add = info.model_dump()
        chat_id = info_for_add.get("chat_id")

        async with self.uow as uow:
            await self._get_chat(chat_id, user_who_add_id, uow)
            try:
                chat_participant = await uow.chat_participant.add_one(info_for_add)
                chat_participant_for_return = ChatParticipantSchema.model_validate(chat_participant)
                await uow.commit()
            except IntegrityError:
                raise DuplicateEntity(
                    detail="Пользователь уже состоит в чате"
                )
            return chat_participant_for_return

    async def delete_user_from_chat(self, user_id: int, chat_id: int):
        async with self.uow as uow:
            await self._get_chat(chat_id, user_id, uow)
            chat_participant = await uow.chat_participant.get_one_by(user_id=user_id, chat_id=chat_id)

            await uow.chat_participant.delete(chat_participant.id)
            await uow.commit()

            user = await uow.user.get_one_by(id=user_id)
            return user.username

    async def get_chat(self, chat_id: int, user_id: int):
        async with self.uow as uow:
            return await self._get_chat(chat_id, user_id, uow)

    async def get_one_by(self, **kwargs):
        async with self.uow as uow:
            return await uow.chat.get_one_by(**kwargs)

    async def check_user_in_chat(self, chat_id: int, user_id: int):
        async with self.uow as uow:
            chat = await uow.chat.get_one(pk=chat_id)
            if not chat:
                raise UnfoundEntity(detail="Чат не найден")

            user = await uow.user.get_one_by(id=user_id)
            if not user:
                raise UnfoundEntity(detail="Такого пользователя нет")

            return await uow.chat_participant.get_one_by(chat_id=chat_id, user_id=user_id)

    async def _get_chat(self, chat_id: int, user_id: int, uow):
        """
        Переиспользуется в методах get_chat и add_user_in_chat,
        сделано чтоб при вызове внутри add_user_in_chat не дублировался uow из-за контекстного менеджера
        """
        chat = await uow.chat.get_one(pk=chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")

        chat_for_user = await uow.chat.get_one_for_user(chat_id, user_id)
        if not chat_for_user:
            raise InaccessibleEntity(detail='Доступ запрещен')
        return chat_for_user

    async def get_all_for_user(self, user_id: int):
        async with self.uow as uow:
            user = await uow.user.get_one_by(id=user_id)
            if not user:
                raise UnfoundEntity(detail="Такого пользователя нет")

            chats = await uow.chat.get_all_for_user(user_id)
            chats_for_return = [ChatSchemaFromBd.model_validate(chat) for chat in chats]
            return chats_for_return


    async def get_all_for_user_with_last_message(self, user_id: int):
        async with self.uow as uow:
            user = await uow.user.get_one_by(id=user_id)
            if not user:
                raise UnfoundEntity(detail="Такого пользователя нет")

            chats = await uow.chat.get_all_for_user(user_id)
            chats_for_return = []
            for chat in chats:
                last_message = await uow.message.get_last_for_chat(chat.id)
                chat_participant = await uow.chat_participant.get_one_by(chat_id=chat.id, user_id=user_id)
                last_read_message_id = chat_participant.last_read_message_id

                chat = ChatSchemaFromBd.model_validate(chat)
                chat = chat.model_dump()
                chat['last_message'] = last_message
                chat['last_read_message_id'] = last_read_message_id
                cnt_unread_messages = await uow.message.get_unread_count(
                            last_read_message_id=chat_participant.last_read_message_id,
                            user_id=chat_participant.user_id,
                            chat_id=chat_participant.chat_id,)
                chat['cnt_unread_messages'] = int(cnt_unread_messages)

                chats_for_return.append(ChatSchemaFromBdWithLastMessage.model_validate(chat))

            def chat_sort_key(chat):
                if chat.last_message:
                    return max(chat.created_at, chat.last_message.created_at)
                return chat.created_at

            chats_for_return.sort(key=chat_sort_key, reverse=True)
            return chats_for_return

    async def update_last_message_read(self, user_id: int, message_id: int) -> None:
        async with self.uow as uow:
            message = await uow.message.get_one(pk=message_id)
            if not message:
                raise UnfoundEntity(detail="Такое сообщение не найдено")
            chat_participant = await uow.chat_participant.get_one_by(chat_id=message.chat_id, user_id=user_id)
            if not chat_participant:
                raise UnfoundEntity(detail = "Пользователь не состоит в этом чате")
            chat_participant.last_read_message_id = message_id
            await uow.commit()

    async def get_all_message_for_chat(self, *, chat_id: int):
        chat = await self.get_one_by(id=chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")

        async with self.uow as uow:
            messages = await uow.message.get_all_for_chat(chat_id=chat_id)

            messages_for_return = [MessageFromDbSchema.model_validate(message) for message in messages]
            return messages_for_return

    async def get_all_message_for_chat_for_member(self, *, chat_id: int, member_id: int):
        chat = await self.get_one_by(id=chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")

        user_in_chat = await self.check_user_in_chat(user_id=member_id, chat_id=chat_id)
        if not user_in_chat:
            raise InaccessibleEntity(detail="Пользователь не состоит в чате")

        async with self.uow as uow:
            messages = await uow.message.get_all_for_chat(chat_id=chat_id)

            messages_for_return = [MessageFromDbSchema.model_validate(message) for message in messages]
            return messages_for_return

    async def get_members(self, chat_id: int, *, return_id: bool = False):
        chat = await self.get_one_by(id=chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")
        async with self.uow as uow:
            users = await uow.user.get_all_members_for_chat(chat_id=chat_id)

            if return_id:
                id_for_return = [user.id for user in users]
                return id_for_return
            users_for_return = [UserSchemaFromBd.model_validate(user) for user in users]
            return users_for_return

    async def get_members_for_member(self, chat_id: int, member_id: int):
        user_in_chat = await self.check_user_in_chat(user_id=member_id, chat_id=chat_id)
        if not user_in_chat:
            raise InaccessibleEntity(detail="Пользователь не состоит в чате")

        async with self.uow as uow:
            users = await uow.user.get_all_members_for_chat(chat_id=chat_id)
            users_for_return = [UserSchemaFromBd.model_validate(user) for user in users]
            return users_for_return




