from .base import Repository
from app.db.models import Task, TaskAssignment

class TaskAssignmentRepository(Repository):
    model = TaskAssignment