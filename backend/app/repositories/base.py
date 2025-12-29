import logging

from abc import ABC, abstractmethod
from sqlalchemy import insert, select, update, delete, inspect
from pydantic import BaseModel

from app.db.database import AsyncSession

logger = logging.getLogger(__name__)

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
        stmt = select(self.model).filter(self.model.id == pk)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_one_by(self, **kwargs):
        stmt = select(self.model)
        for field, value in kwargs.items():
            column = getattr(self.model, field)
            stmt = stmt.filter(column == value)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by(self, **kwargs):
        stmt = select(self.model)
        for field, value in kwargs.items():
            column = getattr(self.model, field)
            stmt = stmt.filter(column == value)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def _adapt_fields(
            self, obj: dict | BaseModel, **kwargs
    ) -> dict:
        "pydantic model to dict+kwargs"
        data = (
            obj.model_dump(exclude_unset=True, exclude_none=True)
            if not isinstance(obj, dict)
            else obj
        )
        data.update(**kwargs)
        return data

    async def update(self, pk: int, data: BaseModel):
        fields_ = await self._adapt_fields(data)
        fields = {}
        info = inspect(self.model)
        for field_ in info.columns.keys() + info.relationships.keys():
            if field_ in fields_:
                fields[field_] = fields_[field_]

        stmt = (update(self.model)
                .where(self.model.id == pk)
                .values(**fields)
                .returning(self.model))
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def delete(self, pk: int):
        stmt = delete(self.model).where(self.model.id == pk)
        await self.session.execute(stmt)
        return True