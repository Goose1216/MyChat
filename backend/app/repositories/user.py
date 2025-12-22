import uuid
from sqlalchemy import insert, select, update, delete, or_, and_, func, case

from .base import Repository
from app.db.models import User, ChatParticipant, RefreshTokens, Message
from app.security import security

class UserRepository(Repository):
    model = User

    async def get_one_with_stat(self, user_id: int, chat_id: int | None):
        stmt_user = select(self.model).where(self.model.id == user_id)
        res_user = await self.session.execute(stmt_user)
        user = res_user.scalars().first()
        if not user:
            return None

        stmt_count = select(func.count(Message.id)).where(Message.sender_id == user_id)
        res_count = await self.session.execute(stmt_count)
        count_message = res_count.scalar() or 0

        count_in_chat = None
        if chat_id is not None:
            stmt_chat = select(func.count(Message.id)).where(
                Message.sender_id == user_id,
                Message.chat_id == chat_id
            )
            res_chat = await self.session.execute(stmt_chat)
            count_in_chat = res_chat.scalar() or None

        return {
            "user": user,
            "count_message": count_message,
            "count_message_in_this_chat": count_in_chat,
        }

    async def get_all_with_stat(self):
        stmt_user = select(self.model)
        res_user = await self.session.execute(stmt_user)
        users = res_user.scalars().all()
        if not users:
            return None

        result = []
        for user in users:
            stmt_count = select(func.count(Message.id)).where(Message.sender_id == user.id)
            res_count = await self.session.execute(stmt_count)
            count_message = res_count.scalar() or 0

            result.append({
                "user": user,
                "count_message": count_message,
            })

        return result

    async def get_all(self, exception_id: int | None = None):
        stmt = select(self.model)
        if exception_id:
            stmt = stmt.where(self.model.id != exception_id)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def check_user_exists(self, email: str, username: str, phone: str | None):
        stmt = select(User).where(
            or_(
                User.email == email,
                User.username == username,
                User.phone == phone if phone else False
            )
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_by_email_or_username(self, username_or_email: str):
        stmt = select(self.model).where(
            or_(
                self.model.email == username_or_email,
                self.model.username == username_or_email,
            )
            )
        res = await self.session.execute(stmt)
        user = res.scalar_one_or_none()
        return user

    async def get_all_members_for_chat(self, chat_id: int):
        stmt = (
            select(self.model)
            .join(ChatParticipant, self.model.id == ChatParticipant.user_id)
            .where(ChatParticipant.chat_id == chat_id)
        )
        res = await self.session.execute(stmt)
        return res.scalars().all()

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

    async def create_jwt_tokens(self, username_or_email: str, user_id: int | None = None, session_id: str | None = None):
        if session_id is None:
            session_id = str(uuid.uuid4())
        user = await self._get_credentials_by_username_or_email(username_or_email=username_or_email)
        username = user['username']
        user_id = user['user_id'] if user_id is None else user_id

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