from .base import Repository
from app.db.models import PrivateChat

class PrivateChatRepository(Repository):
    model = PrivateChat