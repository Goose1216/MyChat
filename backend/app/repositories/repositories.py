import uuid

from app.db.models import User, Chat, ChatParticipant, Message, RefreshTokens
from abc import ABC, abstractmethod
from sqlalchemy import insert, select, update, delete, or_, and_
from app.db.database import AsyncSession
from app.security import security

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


class UserRepository(Repository):
    model = User

    async def get_by_email_or_username(self, username_or_email: str):
        #Для избежании коллизий надо запретить ставить @ в username
        stmt = select(self.model).where(
            or_(
                self.model.email == username_or_email,
                self.model.username == username_or_email,
            )
            )
        res = await self.session.execute(stmt)
        user = res.scalar_one_or_none()
        if user:
            return {
                'user_id': user.id,
                'email': user.email,
                'username': user.username,
                'phone': user.phone,
            }
        return None

    async def _get_credentials_by_username_or_email(self, username_or_email: str):
        stmt = select(self.model).where(
            or_(
                self.model.email == username_or_email,
                self.model.username == username_or_email,
            )
        )
        res = await self.session.execute(stmt)
        user = res.scalar_one_or_none()
        if user:
            return {
                'user_id': user.id,
                'email': user.email,
                'username': user.username,
                'phone': user.phone,
                'password': user.password
            }
        return None

    async def check_credentials(self, username_or_email: str, input_password: str):
        existing_user = await self._get_credentials_by_username_or_email(
            username_or_email=username_or_email,
        )
        if existing_user:
            return security.verify_hash(input_password, existing_user['password'])
        else:
            return False

    async def create_jwt_tokens(self, user_id: int, username: str, session_id: str | None = None):
        if session_id is None:
            session_id = str(uuid.uuid4())
        data = {"user_id" : user_id, "username": username, "session_id": session_id}
        tokens = security.create_jwt_tokens(data)
        if tokens:
            refresh_token = tokens['refresh_token']
            expire_refresh_token = tokens['expires_refresh_at']

            stmt = delete(RefreshTokens).where(
                and_(
                    RefreshTokens.user_id == user_id,
                    RefreshTokens.session_id == session_id,
                )).returning(RefreshTokens)

            res = await self.session.execute(stmt)
            deleted_token = res.scalars().first()
            data_for_insert =  {"user_id": user_id, 'token': refresh_token, "expires_at": expire_refresh_token}

            if deleted_token is not None:
                session_id = deleted_token.session_id
            data_for_insert.update({"session_id": session_id})
            stmt = insert(RefreshTokens).values(data_for_insert).returning(RefreshTokens)

            await self.session.execute(stmt)

            return tokens
        return None

    async def check_refresh_token(self, raw_token: str, user_id: int, session_id: str):
        stmt = select(RefreshTokens).where(
            and_(
                RefreshTokens.user_id == user_id,
                RefreshTokens.token == raw_token
        ))
        res = await self.session.execute(stmt)

        token = res.scalar_one_or_none()

        if token is None:
            stmt = delete(RefreshTokens).where(
                    RefreshTokens.session_id == session_id
                )

            await self.session.execute(stmt)
        return (token is not None)


class ChatRepository(Repository):
    model = Chat


class ChatParticipantRepository(Repository):
    model = ChatParticipant


class MessageRepository(Repository):
    model = Message