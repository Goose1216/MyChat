from app.utils.unit_of_work import IUnitOfWork
from app.app.schemas.users import UserSchemaRegister, UserSchemaFromBd
from app.security.security import PasswordSecurity


class UserService:
    def __init__(self, uow: IUnitOfWork):
        self.uow = uow

    async def add_one(self, user: UserSchemaRegister):
        user_data = user.model_dump()
        async with self.uow as uow:
            password = user_data['password']            
            user_data['password'] = PasswordSecurity.get_password_hash(password)

            user_from_db = await uow.user.add_one(user_data)
            user_for_return = UserSchemaFromBd.model_validate(user_from_db)
            await uow.commit()
            return user_for_return
    
    async def get_by_email_or_username(self, email: str, username: str):
         async with self.uow as uow:
            return await uow.user.get_by_email_or_username(email, username)
    
    async def _hash_password(self, password):
        return pwd_context.hash(password)