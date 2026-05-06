import logging
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
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

# ── Ограничения на загрузку файлов ───────────────────────────────────────────

# Максимальный размер: 20 МБ
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

# Разрешённые MIME-типы и их читаемые названия
ALLOWED_MIME_TYPES: dict[str, str] = {
    # Изображения
    "image/jpeg":       "JPEG-изображение",
    "image/png":        "PNG-изображение",
    "image/gif":        "GIF-изображение",
    "image/webp":       "WebP-изображение",
    "image/svg+xml":    "SVG-изображение",
    # Документы
    "application/pdf":  "PDF-документ",
    "application/msword":                                               "Word-документ (.doc)",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":  "Word-документ (.docx)",
    "application/vnd.ms-excel":                                         "Excel-таблица (.xls)",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"Excel-таблица (.xlsx)",
    "application/vnd.ms-powerpoint":                                    "PowerPoint (.ppt)",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint (.pptx)",
    # Текст
    "text/plain":       "Текстовый файл",
    "text/csv":         "CSV-файл",
    # Архивы
    "application/zip":              "ZIP-архив",
    "application/x-zip-compressed": "ZIP-архив",
    "application/x-rar-compressed": "RAR-архив",
    "application/x-7z-compressed":  "7z-архив",
    # Аудио / видео (базовые)
    "audio/mpeg":   "MP3-аудио",
    "audio/ogg":    "OGG-аудио",
    "video/mp4":    "MP4-видео",
    "video/webm":   "WebM-видео",
}

# Расширения, которые ЗАПРЕЩЕНЫ независимо от content-type (исполняемые файлы)
BLOCKED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".com",
    ".vbs", ".js", ".ts", ".py", ".php", ".rb", ".pl",
    ".jar", ".dll", ".so", ".dylib", ".app",
}


def validate_upload(file: UploadFile) -> None:
    """
    Проверяет загружаемый файл на допустимый тип и размер.
    Бросает HTTPException 400 при нарушении.
    """
    # 1. Проверка расширения
    if file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext in BLOCKED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Файлы с расширением '{ext}' запрещены к загрузке.",
            )

    # 2. Проверка MIME-типа (content_type приходит из заголовка запроса)
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        allowed_list = ", ".join(sorted(set(ALLOWED_MIME_TYPES.values())))
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Тип файла '{content_type}' не разрешён. "
                f"Допустимые типы: {allowed_list}."
            ),
        )

    # 3. Проверка размера — читаем первые MAX+1 байт, чтобы не грузить всё в память
    file.file.seek(0, 2)          # перемотка в конец
    file_size = file.file.tell()  # позиция = размер
    file.file.seek(0)             # перемотка обратно

    if file_size > MAX_FILE_SIZE_BYTES:
        max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
        actual_mb = round(file_size / (1024 * 1024), 2)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Размер файла ({actual_mb} МБ) превышает максимально допустимый ({max_mb} МБ).",
        )


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

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
    validate_upload(file)

    created_file = await service.create(
        message=None,
        stream=file.file,
        filename=file.filename,
    )
    return schemas.Response(data=created_file)


@files.get(
    "/{file_id}/",
    response_model=schemas.Response[schemas.FileGettingFromDbSchema],
    name="Получение метаданных файла",
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