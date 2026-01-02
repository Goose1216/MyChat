from typing import BinaryIO
from pathlib import Path

import aiofiles

from app.core.config import settings
from .base import FileStorageABC


class LocalFileStorage(FileStorageABC):
    def __init__(self, base_url: str):
        self.base_path = base_url

    def _resolve_path(self, url: str | Path) -> Path:
        return Path(self.base_path / url)

    def get_path(self, path: str) -> Path:
        return Path(self._resolve_path(path))

    async def save(
            self,
            stream: BinaryIO,
            path: Path,
            filename: str | None = None,
            chat_id: int | None = None,
    ) -> Path:
        path = self._resolve_path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        async with aiofiles.open(path, "wb") as f:
            while chunk := stream.read(1024 * 1024):
                await f.write(chunk)

        return path

    def delete(self, url: str) -> None:
        path = self._resolve_path(url)
        path.unlink(missing_ok=True)