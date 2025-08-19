from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict

from app.services.services import UserService
from app.app.schemas.users import UserSchemaRegister, UserSchemaLogin
from app.utils.unit_of_work import UnitOfWork, IUnitOfWork
from app.security import security


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
        username_or_email=user_data.email
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
    
    return await user_service.register(user_data)

@users.post("/login")
async def login_user(user_data: UserSchemaLogin, uow: IUnitOfWork = Depends(get_unit_of_work)):
    user_service = UserService(uow)

    if user_service.check_credentials(input_password=user_data.password, username_or_email=user_data.username_or_email):
        tokens = await user_service.create_jwt_tokens(
            user_id=user_data.user_id,
            username = user_data.username
        )
        if tokens:
            return tokens
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token generation failed"
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid data"
        )


@users.post("/refresh_token")
async def update_tokens(refresh_token: Dict = Depends(security.decode_jwt), uow: IUnitOfWork = Depends(get_unit_of_work)):
    """
    Используется для обновления токенов, для этого надо будет передать в заголовке refresh токен, а не access
    """
    if refresh_token.get('type') == 'refresh':
        user_service = UserService(uow)
        is_token = await user_service.check_refresh_token(
            raw_token=refresh_token['raw'],
            user_id=refresh_token['user_id'],
            session_id = refresh_token['session_id']
        )

        if is_token:
            tokens = await user_service.create_jwt_tokens(
                user_id=refresh_token['user_id'],
                username=refresh_token['username'],
                session_id=refresh_token['session_id']
            )
            if tokens:
                return tokens
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token generation failed"
            )
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token, please re-login")
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not correct type token")