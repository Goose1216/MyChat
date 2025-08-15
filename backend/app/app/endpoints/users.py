from fastapi import APIRouter, Depends, HTTPException, status

from app.services.services import UserService
from app.app.schemas.users import UserSchemaRegister, UserSchemaLogin
from app.utils.unit_of_work import UnitOfWork, IUnitOfWork
from app.security.security import PasswordSecurity


users = APIRouter(
    tags=['Users'],
    prefix='/users',
)

async def get_unit_of_work():
    return UnitOfWork()

@users.post("/register")
async def add_user(user_data: UserSchemaRegister, uow: IUnitOfWork = Depends(get_unit_of_work)):
    user_service = UserService(uow)
    
    existing_user = await user_service.get_by_email_or_username(
        email=user_data.email,
        username=user_data.username
    )

    if existing_user:
        if existing_user['email'] == user_data.email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this username already exists"
            )
    
    return await user_service.add_one(user_data)

@users.post("/login")
async def login_user(user_data: UserSchemaLogin, uow: IUnitOfWork = Depends(get_unit_of_work)):
    user_service = UserService(uow)

    existing_user = await user_service.get_by_email_or_username(
        email=user_data.email,
        username=user_data.username
    )

    if existing_user:
        # ✅ ПРАВИЛЬНО: сравниваем введенный пароль с хешем из БД
        if PasswordSecurity.verify_password(user_data.password, existing_user['password']):
            return {"msg": "success", "status": 200}
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid data"
            )
    else:
       raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid data"
            )
    