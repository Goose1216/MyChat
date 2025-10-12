import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from httpx import AsyncClient, ASGITransport
from sqlalchemy.pool import NullPool

from app.main import app
from app.db.database import Base
from app.core.config import settings
from app.app.endpoints.users import get_unit_of_work
from app.utils.unit_of_work import UnitOfWork

@pytest_asyncio.fixture(scope='module')
async def engine():
    engine = create_async_engine(settings.ASYNC_TEST_DATABASE_URL, future=True, echo=True, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture
async def async_session_maker(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session(async_session_maker):
    async with async_session_maker() as session:
        yield session

@pytest_asyncio.fixture
async def client(async_session_maker):
    async def override_uow():
        uow = UnitOfWork()
        uow.session_factory = async_session_maker
        return uow

    app.dependency_overrides[get_unit_of_work] = override_uow

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()
