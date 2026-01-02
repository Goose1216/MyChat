from .base import Repository
from app.db.models import Chat, ChatParticipant
from app.security import security

class ChatParticipantRepository(Repository):
    model = ChatParticipant