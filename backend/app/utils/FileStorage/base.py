from abc import ABC, abstractmethod
from typing import BinaryIO
from pathlib import Path

class FileStorageABC(ABC):

    @abstractmethod
    def get_path(self, path: str) -> Path:
        raise NotImplementedError()

    @abstractmethod
    async def save(
        self,
        key: str,
        stream: BinaryIO,
    ) -> Path:
        raise NotImplementedError()

    @abstractmethod
    def delete(self, url: str) -> None:
        raise NotImplementedError()