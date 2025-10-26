from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.utils.unit_of_work import IUnitOfWork
from app.app.schemas.users import UserSchemaRegister, UserSchemaFromBd
from app.app.schemas.chats import (ChatCreateSchema, ChatParticipantSchema, MessageSchema,
                                   ChatSchemaFromBd, ChatPrivateCreateSchema, ChatParticipantSchemaForAddUser)
from app.app.schemas.message import MessageCreateSchema, MessageFromDbSchema
from app.security import security
from app.db.models import ChatType, UserRole


class UserService:
    def __init__(self, uow: IUnitOfWork):
        self.uow = uow

    async def get_by_id(self, user_id: int):
        async with self.uow as uow:
            user_from_db = await uow.user.get_one(user_id)
            user_for_return = UserSchemaFromBd.model_validate(user_from_db)
            return user_for_return

    async def register(self, user: UserSchemaRegister):
        existing_user = await self.check_user_exists(user)
        if existing_user:
            if existing_user.email == user.email:
                raise HTTPException(status_code=409, detail="User with this email already exists")
            elif existing_user.username == user.username:
                raise HTTPException(status_code=409, detail="User with this username already exists")
            elif existing_user.phone == user.phone:
                raise HTTPException(status_code=409, detail="User with this phone already exists")

        user_data = user.model_dump()
        async with self.uow as uow:
            password = user_data['password']            
            user_data['password'] = security.get_string_hash(password)

            user_from_db = await uow.user.add_one(user_data)
            user_for_return = UserSchemaFromBd.model_validate(user_from_db)
            await uow.commit()
            return user_for_return

    async def check_user_exists(self, user_data: UserSchemaRegister):
        async with self.uow as uow:
            existing_user = await uow.user.check_user_exists(
                email=user_data.email,
                username=user_data.username,
                phone=user_data.phone
            )
            user_for_return = UserSchemaFromBd.model_validate(existing_user) if existing_user is not None else None
            return user_for_return

    async def check_credentials(self, username_or_email: str, input_password: str):
        async with self.uow as uow:
            res = await uow.user.check_credentials(username_or_email=username_or_email, input_password=input_password)
            return res

    async def get_by_email_or_username(self, username_or_email: str):
         async with self.uow as uow:
            res = await uow.user.get_by_email_or_username(username_or_email)
            return res

    async def create_jwt_tokens(self, username_or_email: str, user_id: int | None = None, session_id: str | None = None):
        async with self.uow as uow:
            tokens = await uow.user.create_jwt_tokens(user_id=user_id, username_or_email=username_or_email, session_id=session_id)
            await uow.commit()
            return tokens

    async def check_refresh_token(self, raw_token: str, user_id: int, session_id: str):
        async with self.uow as uow:
            res = await uow.user.check_refresh_token(raw_token=raw_token, user_id=user_id, session_id=session_id)
            await uow.commit()
            return res


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
        async with self.uow as uow:
            chat_id = info_for_add.get("chat_id")

            #Проверка, что тот кто пытается добавить - сам состоит в чате
            await self._get_chat(chat_id, user_who_add_id, uow)

            try:
                chat_participant = await uow.chat_participant.add_one(info_for_add)
                chat_participant_for_return = ChatParticipantSchema.model_validate(chat_participant)
                await uow.commit()
            except IntegrityError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User already in chat"
                )
            return chat_participant_for_return

    async def get_chat(self, chat_id: int, user_id: int):
        async with self.uow as uow:
            return await self._get_chat(chat_id, user_id, uow)

    async def get_one_by(self, **kwargs):
        async with self.uow as uow:
            return await uow.user.get_one_by(**kwargs)

    async def check_user_in_chat(self, chat_id: int, user_id: int):
        async with self.uow as uow:
            return await uow.chat_participant.get_one_by(chat_id=chat_id, user_id=user_id)

    async def _get_chat(self, chat_id: int, user_id: int, uow):
        """
        Переиспользуется в методах get_chat и add_user_in_chat,
        сделано чтоб при вызове внутри add_user_in_chat не дублировался uow из-за контекстного менеджера
        """
        chat = await uow.chat.get_one(chat_id)
        if not chat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

        chat_for_user = await uow.chat.get_one_for_user(chat_id, user_id)
        if not chat_for_user:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

        return chat_for_user

    async def get_all_for_user(self, user_id: int):
        async with self.uow as uow:
            chats = await uow.chat.get_all_for_user(user_id)
            chats_for_return = [ChatSchemaFromBd.model_validate(chat) for chat in chats]
            return chats_for_return

    async def get_all_message_for_chat(self, *, chat_id: int):
        async with self.uow as uow:
            messages = await uow.message.get_all_for_chat(chat_id=chat_id)

            messages_for_return = [MessageFromDbSchema.model_validate(message) for message in messages]
            return messages_for_return

    async def get_members(self, chat_id: int, *, return_id: bool = False):
        async with self.uow as uow:
            users = await uow.user.get_all_members_for_chat(chat_id=chat_id)

            if return_id:
                id_for_return = [user.id for user in users]
                return id_for_return
            users_for_return = [UserSchemaFromBd.model_validate(user) for user in users]
            return users_for_return

class MessageService:
    def __init__(self, uow: IUnitOfWork):
        self.uow = uow

    async def create_message(self, *, chat_id: int, sender_id: int | None = None, data: str | None = None):
        async with self.uow as uow:
            if sender_id:
                is_user_in_chat = await uow.chat_participant.get_one_by(chat_id=chat_id, user_id=sender_id)

                if not is_user_in_chat:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="User not member of chat"
                    )

            message = await uow.message.add_one({"chat_id":chat_id, 'sender_id':sender_id, 'content':data})
            message_for_return = MessageFromDbSchema.model_validate(message)
            await uow.commit()

            return message_for_return




