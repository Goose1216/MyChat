from pathlib import Path
from fastapi import Depends

from app.core.config import settings
from app.utils.unit_of_work import IUnitOfWork
from app.utils.FileStorage import LocalFileStorage
from app.services.file import FileService
from app.utils import get_unit_of_work


def get_storage() -> LocalFileStorage:
    return LocalFileStorage(
        base_url=Path(settings.FILE_STORAGE_PATH)
    )


def get_file_service(
    uow: IUnitOfWork = Depends(get_unit_of_work),
    storage: LocalFileStorage = Depends(get_storage),
) -> FileService:
    return FileService(
        uow=uow,
        storage=storage,
    )