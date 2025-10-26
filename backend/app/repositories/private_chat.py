from sqlalchemy import insert, select, update, delete, or_, and_

from .base import Repository
from app.db.models import PrivateChat

class PrivateChatRepository(Repository):
    model = PrivateChat