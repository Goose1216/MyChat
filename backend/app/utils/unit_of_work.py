from abc import ABC, abstractmethod

from app.repositories import UserRepository, ChatRepository, ChatParticipantRepository, MessageRepository, PrivateChatRepository
from app.db.database import async_session_maker


class IUnitOfWork(ABC):
    @abstractmethod
    def __init__(self):
        raise NotImplemented

    @abstractmethod
    async def __aenter__(self):
        raise NotImplemented

    @abstractmethod
    async def __aexit__(self, *args):
        raise NotImplemented

    @abstractmethod
    async def commit(self):
        raise NotImplemented

    @abstractmethod
    async def rollback(self):
        raise NotImplemented


class UnitOfWork(IUnitOfWork):
    def __init__(self):
        self.session_factory = async_session_maker
        self.session = None

    async def __aenter__(self):
        self.session = self.session_factory()

        self.user = UserRepository(self.session)
        self.chat = ChatRepository(self.session)
        self.chat_private = PrivateChatRepository(self.session)
        self.chat_participant = ChatParticipantRepository(self.session)
        self.message = MessageRepository(self.session)
        return self

    async def __aexit__(self, *args):
        await self.rollback()
        await self.session.close()
        self.session = None

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

async def get_unit_of_work():
    return UnitOfWork()