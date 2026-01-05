from typing import BinaryIO
from uuid import uuid4
from pathlib import Path
from datetime import datetime

from app.app import schemas
from app.db.models import File
from app.utils.unit_of_work import IUnitOfWork
from app.exceptions import InaccessibleEntity, UnfoundEntity
from app.utils.FileStorage import LocalFileStorage
from app.core.config import settings
from app.utils import manager


class FileService:
    def __init__(self, uow: IUnitOfWork, storage: LocalFileStorage):
        self.storage = storage
        self.uow = uow

    async def get_one(self, pk: int):
        async with self.uow as uow:
            file = await uow.file.get_one(pk)
            if not file:
                raise UnfoundEntity(message="Файл не найден")
            file_for_return = schemas.FileGettingFromDbSchema.model_validate(file)
            return file_for_return

    def _create_path(self, chat_id: int | None = None, filename: str | None = None) -> Path:
        if filename is None:
            filename = uuid4().hex
        else:
            filename = uuid4().hex + '-' + filename
        datetime_ = Path(datetime.utcnow().strftime("%Y/%m/%d"))
        filename = Path(filename)

        if chat_id is None:
            path = Path(datetime_ / filename)
        else:
            chat_id = Path(str(chat_id))
            path = Path(chat_id / datetime_ / filename)

        return path

    def _create_url(self, file_id: int) -> str:
        return f"{settings.API_BASE_URL}/files/{file_id}/download/"

    async def create(
            self,
            stream: BinaryIO,
            message: schemas.MessageFromDbSchema | None = None,
            chat_id: int | None = None,
            filename: str | None = None,
    ) -> schemas.FileGettingFromDbSchema:
        path = self._create_path(
            filename=filename,
            chat_id=chat_id,
        )
        async with self.uow as uow:
            file_schema = schemas.FileCreateSchema.model_validate({
                "message_id": message.id if message else None,
                'path': str(path),
                "url": "Null",
                'filename': filename,
            })
            file = await uow.file.add_one(file_schema.model_dump())
            url = self._create_url(file_id=file.id)
            file.url = url
            file_for_return = schemas.FileGettingFromDbSchema.model_validate(file)
            await uow.commit()

            await self.storage.save(
                path=path,
                stream=stream,
                filename=filename,
                chat_id=chat_id,
            )

            return file_for_return

    async def delete(
            self,
            id: int,
    ) -> None:
        async with self.uow as uow:
            file = await uow.file.get_one(id)
            path = file.path

            await uow.file.delete(id)

            self.storage.delete(path)
