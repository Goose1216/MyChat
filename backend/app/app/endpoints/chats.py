import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status, HTTPException
from typing import Dict, Set

from app.services import ChatService, MessageService
from app.app.schemas.chats import (ChatCreateSchema, ChatSchemaFromBd, ChatParticipantSchema,
                                   ChatCreateSchemaForEndpoint, ChatParticipantSchemaForAddUser)
from app.utils.unit_of_work import UnitOfWork, IUnitOfWork
from app.security import security
from app.db.models import ChatType

async def get_unit_of_work():
    return UnitOfWork()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast(self, message: str, chat_id: int, sender_id: int, receivers_id: list[int], **kwargs):
        for receiver_id in receivers_id:
            if receiver_id in self.active_connections:
                for connection in list(self.active_connections[receiver_id]):
                    try:
                        for_send_json = {
                            "text": message,
                            "chat_id": chat_id,
                            "sender_id": sender_id,
                            "it_self": receiver_id == sender_id,
                        }
                        for_send_json.update(**kwargs)

                        await connection.send_json(for_send_json)
                    except Exception:
                        self.active_connections[receiver_id].discard(connection)
                        if not self.active_connections[receiver_id]:
                            del self.active_connections[receiver_id]


chats = APIRouter(
    tags=['Chats'],
    prefix='/chats',
)

manager = ConnectionManager()

async def get_current_user_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Token missing")

    return await security.decode_jwt(token)

@chats.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        access_token = await security.decode_jwt(token)
        if access_token.get('type') != 'access':
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = access_token.get("user_id")
    await websocket.accept()

    uow = await get_unit_of_work()
    chat_service = ChatService(uow)
    message_service = MessageService(uow)

    await manager.connect(websocket, user_id)

    try:
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                chat_id = int(message_data.get("chat_id"))
                text = message_data.get("text", "").strip()

                message = await message_service.create_message(chat_id=chat_id, data=text, sender_id=user_id)

                members_chat = await chat_service.get_members(chat_id, return_id=True)

                await manager.broadcast(
                    message=text,
                    chat_id=chat_id,
                    sender_id=user_id,
                    receivers_id=members_chat,
                    created_at=message.created_at.isoformat(),
                )

            except Exception as e:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                #return
                #await websocket.send_json({"error": f"Server error: {str(e)}"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

@chats.get('')
async def get_all_chat_for_user(access_token = Depends(security.decode_jwt), uow: IUnitOfWork = Depends(get_unit_of_work)):
    if access_token.get('type') == 'access':
        user_id = access_token.get("user_id")
        chat_service = ChatService(uow)
        return await chat_service.get_all_for_user(user_id)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not correct type token")

@chats.get("/{chat_id}/members")
async def get_all_members_for_chat(
                                    chat_id: int,
                                    access_token = Depends(security.decode_jwt),
                                    uow: IUnitOfWork = Depends(get_unit_of_work)
):
    if access_token.get('type') == 'access':
        chat_service = ChatService(uow)
        return await chat_service.get_members(chat_id=chat_id)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not correct type token")

@chats.get("/{chat_id}/messages")
async def get_all_messages_for_chat(
                                    chat_id: int,
                                    access_token = Depends(security.decode_jwt),
                                    uow: IUnitOfWork = Depends(get_unit_of_work)
):
    if access_token.get('type') == 'access':
        chat_service = ChatService(uow)
        return await chat_service.get_all_message_for_chat(chat_id=chat_id)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not correct type token")

@chats.post("/add_user")
async def add_user_in_chat(
                            info_for_add_user: ChatParticipantSchemaForAddUser,
                            access_token = Depends(security.decode_jwt),
                            uow: IUnitOfWork = Depends(get_unit_of_work)
                            ):
    if access_token.get('type') == 'access':
        chat_service = ChatService(uow)
        user_who_add = access_token.get("user_id")
        return await chat_service.add_user_in_chat(user_who_add, info_for_add_user)

    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not correct type token")

@chats.post("")
async def create_chat(
                      info_for_created_chat: ChatCreateSchemaForEndpoint,
                      access_token = Depends(security.decode_jwt),
                      uow: IUnitOfWork = Depends(get_unit_of_work)
                      ):
    if access_token.get('type') == 'access':
        user2_id = info_for_created_chat.user2_id

        user_id = access_token.get("user_id")
        chat_service = ChatService(uow)

        created_chat_dict = info_for_created_chat.model_dump()
        created_chat_dict['user_id'] = user_id
        created_chat = ChatCreateSchema.model_validate(created_chat_dict)
        return await chat_service.create_chat(created_chat, user2_id)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not correct type token")