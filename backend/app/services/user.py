from fastapi import HTTPException

from app.utils.unit_of_work import IUnitOfWork
from app.app.schemas.users import UserSchemaRegister, UserSchemaFromBd
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
