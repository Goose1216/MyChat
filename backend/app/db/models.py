from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, DateTime, Text, Boolean, BigInteger, func, UniqueConstraint, Enum
from datetime import datetime
from typing import Optional, List
import enum

from .database import Base


class ChatType(str, enum.Enum):
    PRIVATE = "private"
    GROUP = "group"
    CHANNEL = "channel"


class UserRole(str, enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"
    OWNER = "owner"


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    messages: Mapped[List["Message"]] = relationship('Message', back_populates='sender')
    chat_participants: Mapped[List["ChatParticipant"]] = relationship('ChatParticipant', back_populates='user')


class Chat(Base):
    __tablename__ = 'chats'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_type: Mapped[ChatType] = mapped_column(Enum(ChatType), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    creator: Mapped['User'] = relationship('User', foreign_keys=[created_by])
    participants: Mapped[List["ChatParticipant"]] = relationship('ChatParticipant', back_populates='chat')
    messages: Mapped[List["Message"]] = relationship('Message', back_populates='chat', cascade="all, delete-orphan")


class ChatParticipant(Base):
    __tablename__ = 'chat_participants'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('chats.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.MEMBER)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    chat: Mapped['Chat'] = relationship('Chat', back_populates='participants')
    user: Mapped['User'] = relationship('User', back_populates='chat_participants')

    __table_args__ = (
        UniqueConstraint('chat_id', 'user_id', name='unique_chat_user'),
    )


class Message(Base):
    __tablename__ = 'messages'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('chats.id'), nullable=False)
    sender_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    chat: Mapped['Chat'] = relationship('Chat', back_populates='messages')
    sender: Mapped['User'] = relationship('User', back_populates='messages')
