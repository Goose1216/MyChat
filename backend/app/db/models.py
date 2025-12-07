from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, DateTime, Text, Boolean, BigInteger, func, UniqueConstraint, Enum, DATETIME
from datetime import datetime
from typing import Optional, List
import enum
import uuid

from .database import Base


class ChatType(str, enum.Enum):
    PRIVATE = "private"
    GROUP = "group"
    CHANNEL = "channel"
    SHARED = "shared"


class UserRole(str, enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"
    OWNER = "owner"


class User(Base):
    __tablename__ = 'users'

    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    password: Mapped[str] = mapped_column(String(1000), nullable=False)

    messages: Mapped[List["Message"]] = relationship('Message', back_populates='sender')
    chat_participants: Mapped[List["ChatParticipant"]] = relationship('ChatParticipant', back_populates='user')
    refresh_tokens: Mapped[List["RefreshTokens"]] = relationship(
        "RefreshTokens",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Chat(Base):
    __tablename__ = 'chats'
    
    chat_type: Mapped[ChatType] = mapped_column(Enum(ChatType), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    participants: Mapped[List["ChatParticipant"]] = relationship('ChatParticipant', back_populates='chat', lazy='selectin', cascade="all, delete-orphan",)
    messages: Mapped[List["Message"]] = relationship('Message', back_populates='chat', cascade="all, delete-orphan", lazy='selectin')

    private_chat: Mapped[Optional["PrivateChat"]] = relationship('PrivateChat', uselist=False, back_populates='chat')


class ChatParticipant(Base):
    __tablename__ = 'chat_participants'

    chat_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('chats.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.MEMBER)

    chat: Mapped['Chat'] = relationship('Chat', back_populates='participants')
    user: Mapped['User'] = relationship('User', back_populates='chat_participants')

    __table_args__ = (
        UniqueConstraint('chat_id', 'user_id', name='unique_chat_user'),
    )


class PrivateChat(Base):
    __tablename__ = 'private_chats'

    chat_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('chats.id'), nullable=False, unique=True)

    user1_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=False)
    user2_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=False)

    chat: Mapped["Chat"] = relationship(
        'Chat',
        back_populates='private_chat',
        cascade="all, delete-orphan",
        single_parent=True
    )

    __table_args__ = (
        UniqueConstraint('user1_id', 'user2_id', name='uq_privatechat_user_pair'),
    )


class Message(Base):
    __tablename__ = 'messages'

    chat_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('chats.id'), nullable=False)
    sender_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chat: Mapped['Chat'] = relationship('Chat', back_populates='messages')
    sender: Mapped['User'] = relationship('User', back_populates='messages', lazy='joined')


class RefreshTokens(Base):
    __tablename__ = 'refresh_tokens'

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True,
                                            default=lambda: str(uuid.uuid4()))

    user = relationship("User", back_populates="refresh_tokens")