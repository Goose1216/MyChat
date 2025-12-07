from app.utils.unit_of_work import IUnitOfWork
from app.app.schemas.users import UserSchemaRegister, UserSchemaFromBd, UserSchemaPatch
from app.security import security
from app.db.models import ChatType, UserRole
from app.exceptions import InaccessibleEntity, UnfoundEntity, DuplicateEntity


class UserService:
    def __init__(self, uow: IUnitOfWork):
        self.uow = uow

    async def get_all(self, exception_id: int | None = None):
        async with self.uow as uow:
            users_from_db = await uow.user.get_all(exception_id=exception_id)
            users_for_return = [UserSchemaFromBd.model_validate(user_from_db) for user_from_db in users_from_db]
            return users_for_return

    async def get_by_id(self, user_id: int):
        async with self.uow as uow:
            user_from_db = await uow.user.get_one(user_id)
            user_for_return = UserSchemaFromBd.model_validate(user_from_db)
            return user_for_return

    async def register(self, user: UserSchemaRegister):
        existing_user = await self.check_user_exists(user)
        if existing_user:
            if existing_user.email == user.email and user.email is not None:
                raise DuplicateEntity(detail="Пользователь с таким емейлом уже существует")
            elif existing_user.username == user.username and user.username is not None:
                raise DuplicateEntity(detail="Пользователь с таким логином уже существует")
            elif existing_user.phone == user.phone and user.phone is not None:
                raise DuplicateEntity(detail="Пользователь с таким номером телефона уже существует")

        user_data = user.model_dump()
        async with self.uow as uow:
            password = user_data['password']
            password = security.validate_password(password)
            user_data['password'] = security.get_string_hash(password)

            user_data['phone'] = security.validate_phone(user_data['phone'])
            user_data['username'] = security.validate_username(user_data['username'])

            user_from_db = await uow.user.add_one(user_data)
            user_for_return = UserSchemaFromBd.model_validate(user_from_db)
            await uow.commit()
            return user_for_return

    async def patch(self, pk: int, data: UserSchemaPatch):
        async with self.uow as uow:
            user_from_db = await uow.user.update(pk, data)
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
            user_for_return = UserSchemaFromBd.model_validate(res) if res is not None else None
            return user_for_return

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
