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

    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    password: Mapped[str] = mapped_column(String(1000), nullable=False)

    messages: Mapped[List["Message"]] = relationship('Message', back_populates='sender')
    chat_participants: Mapped[List["ChatParticipant"]] = relationship('ChatParticipant', back_populates='user')


class Chat(Base):
    __tablename__ = 'chats'
    
    chat_type: Mapped[ChatType] = mapped_column(Enum(ChatType), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    participants: Mapped[List["ChatParticipant"]] = relationship('ChatParticipant', back_populates='chat')
    messages: Mapped[List["Message"]] = relationship('Message', back_populates='chat', cascade="all, delete-orphan")


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


class Message(Base):
    __tablename__ = 'messages'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('chats.id'), nullable=False)
    sender_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    chat: Mapped['Chat'] = relationship('Chat', back_populates='messages')
    sender: Mapped['User'] = relationship('User', back_populates='messages')
