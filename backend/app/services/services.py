from app.utils.unit_of_work import IUnitOfWork
from app.app.schemas.users import UserSchemaRegister, UserSchemaFromBd
from app.app.schemas.chats import ChatCreateSchema, ChatParticipantSchema, MessageSchema, ChatSchemaFromBd
from app.security import security


class UserService:
    def __init__(self, uow: IUnitOfWork):
        self.uow = uow

    async def register(self, user: UserSchemaRegister):
        user_data = user.model_dump()
        async with self.uow as uow:
            password = user_data['password']            
            user_data['password'] = security.get_string_hash(password)

            user_from_db = await uow.user.add_one(user_data)
            user_for_return = UserSchemaFromBd.model_validate(user_from_db)
            await uow.commit()
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

    async def create_chat(self, chat: ChatCreateSchema):
        chat_create_data = chat.model_dump()
        user1_id = chat_create_data.pop("user1_id")
        user2_id = chat_create_data.pop("user2_id")

        async with self.uow as uow:
            chat_created = await uow.chat.add_one(chat_create_data)
            chat_for_return = ChatSchemaFromBd.model_validate(chat_created)
            chat_id = chat_for_return.id

            #Проверку потом добавть что chat_participant создалость нормально
            chat_participant1 = await uow.chat_participant.add_one({"user_id": user1_id, "chat_id": chat_id})
            chat_participant2 = await uow.chat_participant.add_one({"user_id": user2_id, "chat_id": chat_id})
            await uow.commit()
            return chat_for_return


    async def add_user_in_chat(self, user_info: ChatParticipantSchema):
        user = user_info.model_dump()
        async with self.uow as uow:
            chat_id = user.chat_id
            chat = await uow.chat.get_one(chat_id)
            if chat:
                chat_participant = await uow.chat_participant.add_one(user_info)
                chat_participant_for_return = ChatParticipantSchema.model_validate(chat_participant)
                await uow.commit()
                return chat_participant_for_return
            else:
                raise Exception("Чата нет")

    async def get_chat(self, chat_id: int):
        async with self.uow as uow:
            chat = await uow.chat.get_one(chat_id)
            return chat

    async def is_user_in_chat(self, chat_id: int, user_id: int):
        pass

    async def get_all_for_user(self, user_id: int):
        async with self.uow as uow:
            chats = await uow.chat.get_all_for_user(user_id)
            return chats