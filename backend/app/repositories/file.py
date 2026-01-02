from .base import Repository
from app.db.models import File
from app.security import security

class FileRepository(Repository):
    model = File
