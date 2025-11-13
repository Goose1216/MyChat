from abc import ABC, abstractmethod
from sqlalchemy import insert, select, update, delete
from app.db.database import AsyncSession


class AbstractRepository(ABC):
    @abstractmethod
    async def add_one(self, data: dict):
        raise NotImplemented

    @abstractmethod
    async def get_all(self):
        raise NotImplemented

    @abstractmethod
    async def get_one(self, pk: int):
        raise NotImplemented

    @abstractmethod
    async def get_one_by(self, **kwargs):
        raise NotImplemented

    @abstractmethod
    async def get_by(self, **kwargs):
        raise NotImplemented

    @abstractmethod
    async def update(self, pk: int):
        raise NotImplemented

    @abstractmethod
    async def delete(self, pk: int):
        raise NotImplemented


class Repository(ABC):
    model = None

    def __init__(self, session: AsyncSession):
        self.session = session

    async def add_one(self, data: dict):
        stmt = insert(self.model).values(**data).returning(self.model)
        res = await self.session.execute(stmt)
        return res.scalar_one()

    async def get_all(self):
        stmt = select(self.model)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def get_one(self, pk: int):
        stmt = select(self.model).where(self.model.id == pk)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_one_by(self, **kwargs):
        stmt = select(self.model)
        for field, value in kwargs.items():
            column = getattr(self.model, field)
            stmt = stmt.where(column == value)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by(self, **kwargs):
        stmt = select(self.model)
        for field, value in kwargs.items():
            column = getattr(self.model, field)
            stmt = stmt.where(column == value)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def update(self, pk: int, data: dict):
        stmt = (update(self.model)
                .where(self.model.id == pk)
                .values(**data)
                .returning(self.model))
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def delete(self, pk: int):
        stmt = delete(self.model).where(self.model.id == pk)
        await self.session.execute(stmt)
        return True