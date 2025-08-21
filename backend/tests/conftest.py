import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.database import Base
from app.core.config import settings
from app.app.endpoints.users import get_unit_of_work
from app.utils.unit_of_work import UnitOfWork


# По хорошему создавать бд для сессии, а не для каждого теста отдельно, но тогда возникает EVENT LOOP
@pytest_asyncio.fixture
async def engine():
    engine = create_async_engine(settings.ASYNC_TEST_DATABASE_URL, future=True, echo=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def async_session_maker(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session(engine, async_session_maker):
    async with engine.connect() as connection:
        trans = await connection.begin()

        session = async_session_maker(bind=connection)
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()


@pytest_asyncio.fixture
async def client(db_session, async_session_maker):
    class TestUnitOfWork(UnitOfWork):
        def __init__(self):
            super().__init__()
            self.session_factory = async_session_maker

    async def override_uow():
        return TestUnitOfWork()

    app.dependency_overrides[get_unit_of_work] = override_uow

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()
