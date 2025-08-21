from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from typing import List, Dict
from app.security import security

chats = APIRouter(
    tags=['Chats'],
    prefix='/chats',
)

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


manager = ConnectionManager()


@chats.websocket("/{chat_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int, user_id: int):
    await manager.connect(websocket, chat_id=chat_id, user_id=user_id)
    await manager.broadcast(f"{'username'} (ID: {user_id}) присоединился к чату.", chat_id=chat_id, sender_id=user_id)

    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(message=f"{'username'} (ID: {user_id}): {data}", chat_id=chat_id, sender_id=user_id)
    except WebSocketDisconnect:
        manager.disconnect(chat_id=chat_id, user_id=user_id)
        await manager.broadcast(message=f"{'username'} (ID: {user_id}) покинул чат.", chat_id=chat_id, sender_id=user_id)