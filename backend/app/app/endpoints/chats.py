import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status, HTTPException
from typing import Dict, Set, List

from app.services import ChatService, MessageService
from app.app import schemas
from app.app.schemas.chats import (ChatCreateSchema, ChatSchemaFromBd, ChatParticipantSchema,
                                   ChatCreateSchemaForEndpoint, ChatParticipantSchemaForAddUser)
from app.utils.unit_of_work import UnitOfWork, IUnitOfWork
from app.security import security
from app.db.models import ChatType
from app.app.schemas.response import Response
from app.utils.response import get_responses_description_by_codes
from app.utils import manager, get_unit_of_work
from app.exceptions import NotAuthenticated, EntityError


chats = APIRouter(
    tags=['Чаты'],
    prefix='/chats',
)

async def get_current_user_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        raise NotAuthenticated(detail="Токен не передан")

    return await security.decode_jwt_access(token)

@chats.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")

    if not token:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        access_token = await security.decode_jwt_access(token)
    except Exception:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = access_token.get("user_id")
    await websocket.accept()
    await manager.connect(websocket, user_id)

    uow = await get_unit_of_work()
    chat_service = ChatService(uow)
    message_service = MessageService(uow)

    try:
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                chat_id = int(message_data.get("chat_id"))
                text = message_data.get("text", "").strip()

                message = await message_service.create_message(chat_id=chat_id, data=text, sender_id=user_id)
                print(message)
                members_chat = await chat_service.get_members(chat_id, return_id=True)
                print(members_chat)
                await manager.broadcast(
                    message=text,
                    chat_id=chat_id,
                    sender_id=user_id,
                    receivers_id=members_chat,
                    created_at=message.created_at.isoformat(),
                )

            except Exception as e:
               raise WebSocketDisconnect

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

@chats.get(
    '/',
    response_model=schemas.Response[List[schemas.ChatSchemaFromBd]],
    name="Получить все чаты для пользователя",
    responses = get_responses_description_by_codes([401, 403])
)
async def get_all_chat_for_user(
        access_token = Depends(security.decode_jwt_access),
        uow: IUnitOfWork = Depends(get_unit_of_work)
):
    user_id = access_token.get("user_id")
    chat_service = ChatService(uow)
    chat = await chat_service.get_all_for_user(user_id)
    return schemas.Response(data=chat)

@chats.get(
    "/{chat_id}/members/",
    response_model = schemas.Response[List[schemas.UserSchemaFromBd]],
    name="Получение всех участников чата",
    description="Только для участников этого чата",
    responses = get_responses_description_by_codes([401, 403, 404])
)
async def get_all_members_for_chat(
                                    chat_id: int,
                                    access_token = Depends(security.decode_jwt_access),
                                    uow: IUnitOfWork = Depends(get_unit_of_work)
):
    chat_service = ChatService(uow)
    members = await chat_service.get_members_for_member(chat_id=chat_id, member_id=int(access_token.get("user_id")))
    return schemas.Response(data=members)

@chats.get(
    "/{chat_id}/messages/",
    response_model=schemas.Response[List[schemas.MessageFromDbSchema]],
    name="Получение всех сообщений чата",
    description="Только для участников этого чата",
    responses=get_responses_description_by_codes([401, 403, 404])
)
async def get_all_messages_for_chat(
                                    chat_id: int,
                                    access_token = Depends(security.decode_jwt_access),
                                    uow: IUnitOfWork = Depends(get_unit_of_work)
):
    chat_service = ChatService(uow)
    messages = await chat_service.get_all_message_for_chat_for_member(chat_id=chat_id, member_id=access_token.get("user_id"))
    return schemas.Response(data=messages)

@chats.post(
    "/add_user/",
    response_model=schemas.Response[schemas.UserSchemaFromBd],
    name="Добавить пользователя в чат",
    description="Только для участников этого чата",
    responses=get_responses_description_by_codes([401, 403, 404])
)
async def add_user_in_chat(
                            info_for_add_user: ChatParticipantSchemaForAddUser,
                            access_token = Depends(security.decode_jwt_access),
                            uow: IUnitOfWork = Depends(get_unit_of_work)
                            ):
    chat_service = ChatService(uow)
    user_who_add = access_token.get("user_id")
    user = await chat_service.add_user_in_chat(user_who_add, info_for_add_user)
    return schemas.Response(data=user)

@chats.post(
    "/",
    response_model=schemas.Response[schemas.ChatSchemaFromBd],
    name="Создать чат",
    description = "Если чат приватный, то надо передать id второго пользователя, если не приватный то обязательно надо передать title",
    responses=get_responses_description_by_codes([401, 403, 404])
)
async def create_chat(
                      info_for_created_chat: ChatCreateSchemaForEndpoint,
                      access_token = Depends(security.decode_jwt_access),
                      uow: IUnitOfWork = Depends(get_unit_of_work)
                      ):
    user2_id = info_for_created_chat.user2_id

    user_id = access_token.get("user_id")
    chat_service = ChatService(uow)

    created_chat_dict = info_for_created_chat.model_dump()
    created_chat_dict['user_id'] = user_id
    created_chat = ChatCreateSchema.model_validate(created_chat_dict)
    chat = await chat_service.create_chat(created_chat, user2_id)
    return schemas.Response(data=chat)
