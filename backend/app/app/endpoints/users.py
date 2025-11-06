from fastapi import APIRouter, Depends, HTTPException, status, Form
from typing import Dict, List

from app.services import UserService
from app.app.schemas.users import UserSchemaRegister, UserSchemaLogin
from app.utils.unit_of_work import UnitOfWork, IUnitOfWork
from app.security import security
from app.app import schemas
from app.utils.response import get_responses_description_by_codes
from app.utils import get_unit_of_work
from app.exceptions import NotAuthenticated, InaccessibleEntity, UnprocessableEntity, EntityError

users = APIRouter(
    tags=['Пользователи'],
    prefix='/users',
)

@users.get(
    "/me/",
    response_model=schemas.Response[schemas.UserSchemaFromBd],
    name="Получить пользователя",
    responses=get_responses_description_by_codes([401, 403])
)
async def get_user(
        access_token = Depends(security.decode_jwt_access),
        uow: IUnitOfWork = Depends(get_unit_of_work)):
    if access_token.get('type') == 'access':
        user_id = access_token.get("user_id")
        user_service = UserService(uow)
        user = await user_service.get_by_id(user_id)
        return schemas.Response(data=user)
    else:
        raise NotAuthenticated(detail="Неправильный тип токена")

@users.post(
    "/register/",
    response_model=schemas.Response[schemas.UserSchemaFromBd],
    name="Зарегистрироваться",
    responses=get_responses_description_by_codes([401, 403])
)
async def add_user(user_data: UserSchemaRegister, uow: IUnitOfWork = Depends(get_unit_of_work)):
    user_service = UserService(uow)
    user = await user_service.register(user_data)
    return schemas.Response(data=user)

@users.post(
    "/login/swagger/",
    name = "Вход",
    description = "Используется только для интерактивной документации",
)
async def login_user(username: str = Form(...), password: str = Form(...), uow: IUnitOfWork = Depends(get_unit_of_work)):
    user_service = UserService(uow)

    if await user_service.check_credentials(input_password=password, username_or_email=username):

        user = await user_service.get_by_email_or_username(username_or_email=username)
        user_id = user.id

        data = {"user_id": user_id, "username_or_email": username}
        return security.create_jwt_for_swagger(data)
    else:
        raise NotAuthenticated(
            detail="Неправильный токен"
        )

@users.post(
    "/login/",
    response_model=schemas.Response[schemas.Tokens],
    name="Вход",
    responses=get_responses_description_by_codes([401, 403])
)
async def login_user(
        user_data: UserSchemaLogin,
        uow: IUnitOfWork = Depends(get_unit_of_work)
):
    user_service = UserService(uow)

    if await user_service.check_credentials(input_password=user_data.password, username_or_email=user_data.username_or_email):
        tokens = await user_service.create_jwt_tokens(
            username_or_email = user_data.username_or_email
        )
        if tokens:
            return schemas.Response(data=tokens)
        raise EntityError(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Генерация токена провалилась"
        )
    else:
        raise NotAuthenticated(
            detail="Неверные данные"
        )

@users.post(
    "/refresh_token/",
    response_model=schemas.Response[schemas.Tokens],
    name="Обновить пару access, refresh",
    responses=get_responses_description_by_codes([401, 403]),
    description = 'Используется для обновления токенов, для этого надо будет передать в заголовке refresh токен, а не access'
)
async def update_tokens(
        refresh_token: Dict = Depends(security.decode_jwt_refresh),
        uow: IUnitOfWork = Depends(get_unit_of_work)
):
    user_service = UserService(uow)
    is_token = await user_service.check_refresh_token(
        raw_token=refresh_token['raw'],
        user_id=refresh_token['user_id'],
        session_id = refresh_token['session_id']
    )

    if is_token:
        tokens = await user_service.create_jwt_tokens(
            user_id=refresh_token['user_id'],
            username_or_email=refresh_token['username'],
            session_id=refresh_token['session_id']
        )
        if tokens:
            return schemas.Response(data=tokens)
        raise EntityError(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Генерация токена провалилась"
        )
    else:
        raise NotAuthenticated(detail="Неправильный токен, зайдите снова")
