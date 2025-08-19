from app.utils.unit_of_work import IUnitOfWork
from app.app.schemas.users import UserSchemaRegister, UserSchemaFromBd
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
            res = await uow.user.check_password(username_or_email=username_or_email, input_password=input_password)
            return res

    async def get_by_email_or_username(self, username_or_email: str):
        #устаревшее скорее всего можно удалить
         async with self.uow as uow:
            res = await uow.user.get_by_email_or_username(username_or_email)
            return res

    async def create_jwt_tokens(self, user_id: int, username: str, session_id: str | None = None):
        async with self.uow as uow:
            tokens = await uow.user.create_jwt_tokens(user_id, username, session_id)
            await uow.commit()
            return tokens

    async def check_refresh_token(self, raw_token: str, user_id: int, session_id: str):
        async with self.uow as uow:
            res = await uow.user.check_refresh_token(raw_token=raw_token, user_id=user_id, session_id=session_id)
            await uow.commit()
            return res