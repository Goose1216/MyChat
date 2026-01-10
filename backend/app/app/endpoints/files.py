import logging

from fastapi import APIRouter, UploadFile, File, Depends
from fastapi.responses import FileResponse

from app.services.file import FileService
from app.services import MessageService
from app.utils.file import get_file_service
from app.app import schemas
from app.security import security
from app.exceptions import UnfoundEntity
from app.utils.unit_of_work import UnitOfWork, IUnitOfWork
from app.utils import get_unit_of_work

files = APIRouter(
    prefix="/files",
    tags=["Файлы"],
)
logger = logging.getLogger(__name__)

@files.post(
    "/upload/",
    response_model=schemas.Response[schemas.FileGettingFromDbSchema],
    name="Загрузка файлов",
)
async def upload_file(
    file: UploadFile = File(...),
    service: FileService = Depends(get_file_service),
    access_token=Depends(security.decode_jwt_access),
):

    created_file = await service.create(
        message=None,
        stream=file.file,
        filename=file.filename,
    )

    return schemas.Response(data=created_file)

@files.get(
    "/{file_id}/",
    response_model=schemas.Response[schemas.FileGettingFromDbSchema],
    name="Получение метаданных файла"
)
async def get_file(
    file_id: int,
    service: FileService = Depends(get_file_service),
    access_token=Depends(security.decode_jwt_access),
):
    file = await service.get_one(file_id)

    return schemas.Response(data=file)

@files.delete(
    "/{file_id}/",
    name="Удаление файла",
    response_model=schemas.Response[None],
)
async def delete_file(
    file_id: int,
    service: FileService = Depends(get_file_service),
    access_token=Depends(security.decode_jwt_access),
):
    await service.delete(file_id)
    return schemas.Response(data=None)

@files.get(
    "/{file_id}/download/",
    name="Скачивание файла",
)
async def download_file(
    file_id: int,
    service: FileService = Depends(get_file_service),
):
    file = await service.get_one(file_id)
    if not file:
        raise UnfoundEntity(message="Файл не найден")

    path = service.storage.get_path(file.path)
    logger.debug(path)

    return FileResponse(
        path=path,
        filename=file.filename,
        media_type="application/octet-stream",
    )
