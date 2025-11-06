from fastapi import WebSocket
from typing import Dict, Set

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
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
                        print(for_send_json)

                        await connection.send_json(for_send_json)
                    except Exception:
                        self.active_connections[receiver_id].discard(connection)
                        if not self.active_connections[receiver_id]:
                            del self.active_connections[receiver_id]

manager = ConnectionManager()
