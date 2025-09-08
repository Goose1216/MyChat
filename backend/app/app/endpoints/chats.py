from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status, HTTPException
from typing import Dict
from app.services.services import ChatService
from app.app.schemas.chats import ChatCreateSchema, ChatSchemaFromBd, ChatParticipantSchema, ChatCreateSchemaForEndpoint
from app.utils.unit_of_work import UnitOfWork, IUnitOfWork
from app.security import security

async def get_unit_of_work():
    return UnitOfWork()

class ConnectionManager:
    def __init__(self):
        # Хранение активных соединений в виде {chat_id: {user_id: WebSocket}
        self.active_connections: Dict[int, Dict[int, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int, chat_id: int):
        await websocket.accept()
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = {}
        self.active_connections[chat_id][user_id] = websocket

    def disconnect(self, user_id: int, chat_id: int):
        self.active_connections[chat_id].pop(user_id, None)

    async def broadcast(self, message: str, chat_id: int, sender_id: int):
        for user_id, connection in self.active_connections[chat_id].items():
            answer_json = {
                "text": message,
                'it_self': user_id == sender_id
            }
            await connection.send_json(answer_json)


chats = APIRouter(
    tags=['Chats'],
    prefix='/chats',
)

manager = ConnectionManager()


@chats.websocket("/{chat_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int, user_id: int, uow: IUnitOfWork = Depends(get_unit_of_work)):
    chat_service = ChatService(uow)

    await manager.connect(websocket, chat_id=chat_id, user_id=user_id)
    await manager.broadcast(f"{'username'} (ID: {user_id}) присоединился к чату.", chat_id=chat_id, sender_id=user_id)

    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(message=f"{'username'} (ID: {user_id}): {data}", chat_id=chat_id, sender_id=user_id)
    except WebSocketDisconnect:
        manager.disconnect(chat_id=chat_id, user_id=user_id)
        await manager.broadcast(message=f"{'username'} (ID: {user_id}) покинул чат.", chat_id=chat_id, sender_id=user_id)

@chats.get('')
async def get_all_chat_for_user(access_token = Depends(security.decode_jwt), uow: IUnitOfWork = Depends(get_unit_of_work)):
    if access_token.get('type') == 'access':
        user_id = access_token.get("user_id")
        chat_service = ChatService(uow)
        return await chat_service.get_all_for_user(user_id)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not correct type token")

@chats.post("/create")
async def create_chat(info_for_created_chat: ChatCreateSchemaForEndpoint,
                      access_token = Depends(security.decode_jwt),
                      uow: IUnitOfWork = Depends(get_unit_of_work)
                      ):
    if access_token.get('type') == 'access':
        user1_id = access_token.get("user_id")
        chat_service = ChatService(uow)

        created_chat_dict = info_for_created_chat.model_dump()
        created_chat_dict['user1_id'] = user1_id
        print(created_chat_dict)
        created_chat = ChatCreateSchema.model_validate(created_chat_dict)
        return await chat_service.create_chat(created_chat)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not correct type token")