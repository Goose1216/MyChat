"""
Административный роутер.
Все эндпоинты доступны только пользователям с is_superuser=True.
Префикс: /admin
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, update, delete

from app.security.security import require_superuser, decode_jwt_access
from app.security import security as _sec
from app.utils.unit_of_work import IUnitOfWork
from app.utils import get_unit_of_work
from app.db.models import User, Chat, ChatParticipant, Message, ChatType, UserRole
from app.app.schemas.response import Response
from app.app.schemas.users import (
    UserSchemaFromBd, AdminUserPatch, AdminSetPassword, UserSchemaRegister,
)
from app.app.schemas.chats import (
    AdminChatPatch, AdminChatDetailSchema, AdminChatParticipantSchema,
    AdminMessageSchema, AdminAddParticipantSchema, ChatSchemaFromBd,
    ChangeRoleSchema,
)
from app.utils.response import get_responses_description_by_codes
from app.exceptions import UnfoundEntity, DuplicateEntity, EntityError

logger = logging.getLogger(__name__)

admin = APIRouter(
    prefix="/admin",
    tags=["Администрирование"],
    dependencies=[Depends(require_superuser)],
)


# ══════════════════════════════════════════════════════════════════════════════
#  USERS
# ══════════════════════════════════════════════════════════════════════════════

@admin.get(
    "/users/",
    response_model=Response[List[UserSchemaFromBd]],
    name="[Админ] Все пользователи",
    description="Список всех пользователей, включая удалённых. Поддерживает поиск и пагинацию.",
)
async def admin_list_users(
    search: str | None = Query(None, description="Поиск по username / email"),
    include_deleted: bool = Query(False, description="Включить удалённых"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        stmt = select(User)
        if not include_deleted:
            stmt = stmt.where(User.is_deleted == False)
        if search:
            like = f"%{search}%"
            stmt = stmt.where(
                (User.username.ilike(like)) | (User.email.ilike(like))
            )
        stmt = stmt.offset(offset).limit(limit).order_by(User.id)
        res = await uow.session.execute(stmt)
        users = res.scalars().all()
        return Response(data=[UserSchemaFromBd.model_validate(u) for u in users])


@admin.get(
    "/users/{user_id}/",
    response_model=Response[UserSchemaFromBd],
    name="[Админ] Получить пользователя",
)
async def admin_get_user(
    user_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        user = await uow.user.get_one(user_id)
        if not user:
            raise UnfoundEntity(detail="Пользователь не найден")
        return Response(data=UserSchemaFromBd.model_validate(user))


@admin.patch(
    "/users/{user_id}/",
    response_model=Response[UserSchemaFromBd],
    name="[Админ] Изменить пользователя",
    description="Можно изменить любое поле, включая is_superuser, is_deleted, is_verified.",
)
async def admin_patch_user(
    user_id: int,
    data: AdminUserPatch,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        user = await uow.user.get_one(user_id)
        if not user:
            raise UnfoundEntity(detail="Пользователь не найден")
        fields = data.model_dump(exclude_unset=True, exclude_none=True)
        if fields:
            stmt = (
                update(User)
                .where(User.id == user_id)
                .values(**fields)
                .returning(User)
            )
            res = await uow.session.execute(stmt)
            user = res.scalar_one()
        user_for_return = UserSchemaFromBd.model_validate(user)
        await uow.commit()
        return Response(data=user_for_return)


@admin.post(
    "/users/{user_id}/set_password/",
    response_model=Response[None],
    name="[Админ] Сбросить пароль пользователя",
)
async def admin_set_password(
    user_id: int,
    data: AdminSetPassword,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        user = await uow.user.get_one(user_id)
        if not user:
            raise UnfoundEntity(detail="Пользователь не найден")
        validated = _sec.validate_password(data.new_password)
        hashed = _sec.get_string_hash(validated)
        stmt = update(User).where(User.id == user_id).values(password=hashed)
        await uow.session.execute(stmt)
        await uow.commit()
        return Response(data=None)


@admin.post(
    "/users/{user_id}/make_superuser/",
    response_model=Response[UserSchemaFromBd],
    name="[Админ] Назначить суперпользователем",
)
async def admin_make_superuser(
    user_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        user = await uow.user.get_one(user_id)
        if not user:
            raise UnfoundEntity(detail="Пользователь не найден")
        stmt = update(User).where(User.id == user_id).values(is_superuser=True).returning(User)
        res = await uow.session.execute(stmt)
        user = res.scalar_one()
        user_for_return = UserSchemaFromBd.model_validate(user)
        await uow.commit()
        return Response(data=user_for_return)


@admin.post(
    "/users/{user_id}/revoke_superuser/",
    response_model=Response[UserSchemaFromBd],
    name="[Админ] Снять права суперпользователя",
)
async def admin_revoke_superuser(
    user_id: int,
    _token: dict = Depends(decode_jwt_access),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    # Нельзя снять права у самого себя
    if int(_token.get("user_id")) == user_id:
        raise EntityError(detail="Нельзя снять права суперпользователя у самого себя")
    async with uow as uow:
        user = await uow.user.get_one(user_id)
        if not user:
            raise UnfoundEntity(detail="Пользователь не найден")
        stmt = update(User).where(User.id == user_id).values(is_superuser=False).returning(User)
        res = await uow.session.execute(stmt)
        user = res.scalar_one()
        user_for_return = UserSchemaFromBd.model_validate(user)
        await uow.commit()
        return Response(data=user_for_return)


@admin.delete(
    "/users/{user_id}/",
    response_model=Response[None],
    name="[Админ] Мягкое удаление пользователя",
    description="Устанавливает is_deleted=True. Для полного удаления используйте /hard_delete/.",
)
async def admin_soft_delete_user(
    user_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        user = await uow.user.get_one(user_id)
        if not user:
            raise UnfoundEntity(detail="Пользователь не найден")
        stmt = update(User).where(User.id == user_id).values(is_deleted=True)
        await uow.session.execute(stmt)
        await uow.commit()
        return Response(data=None)


@admin.delete(
    "/users/{user_id}/hard_delete/",
    response_model=Response[None],
    name="[Админ] Полное удаление пользователя из БД",
    description="⚠️ Необратимо. Удаляет пользователя и все связанные данные через CASCADE.",
)
async def admin_hard_delete_user(
    user_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        user = await uow.user.get_one(user_id)
        if not user:
            raise UnfoundEntity(detail="Пользователь не найден")
        stmt = delete(User).where(User.id == user_id)
        await uow.session.execute(stmt)
        await uow.commit()
        return Response(data=None)


# ══════════════════════════════════════════════════════════════════════════════
#  CHATS
# ══════════════════════════════════════════════════════════════════════════════

@admin.get(
    "/chats/",
    response_model=Response[List[AdminChatDetailSchema]],
    name="[Админ] Все чаты",
    description="Список всех чатов с участниками и числом сообщений.",
)
async def admin_list_chats(
    chat_type: str | None = Query(None, description="private / group / channel"),
    include_deleted: bool = Query(False),
    search: str | None = Query(None, description="Поиск по title"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        stmt = select(Chat)
        if not include_deleted:
            stmt = stmt.where(Chat.is_deleted == False)
        if chat_type:
            try:
                stmt = stmt.where(Chat.chat_type == ChatType(chat_type))
            except ValueError:
                raise EntityError(detail=f"Неверный тип чата: {chat_type}. Допустимые: private, group, channel")
        if search:
            stmt = stmt.where(Chat.title.ilike(f"%{search}%"))
        stmt = stmt.offset(offset).limit(limit).order_by(Chat.id)
        res = await uow.session.execute(stmt)
        chats = res.scalars().all()

        result = []
        for chat in chats:
            # Участники с ролями
            cp_stmt = (
                select(ChatParticipant, User)
                .join(User, ChatParticipant.user_id == User.id)
                .where(ChatParticipant.chat_id == chat.id)
            )
            cp_res = await uow.session.execute(cp_stmt)
            participants = [
                AdminChatParticipantSchema(
                    user_id=cp.user_id,
                    username=u.username,
                    email=u.email,
                    role=cp.role.value if hasattr(cp.role, "value") else str(cp.role),
                )
                for cp, u in cp_res.all()
            ]

            # Число сообщений
            msg_cnt_stmt = select(func.count(Message.id)).where(
                Message.chat_id == chat.id, Message.is_deleted == False
            )
            msg_cnt = (await uow.session.execute(msg_cnt_stmt)).scalar() or 0

            chat_dict = ChatSchemaFromBd.model_validate(chat).model_dump()
            chat_dict["participants"] = participants
            chat_dict["message_count"] = msg_cnt
            result.append(AdminChatDetailSchema.model_validate(chat_dict))

        return Response(data=result)


@admin.get(
    "/chats/{chat_id}/",
    response_model=Response[AdminChatDetailSchema],
    name="[Админ] Получить чат",
)
async def admin_get_chat(
    chat_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        chat = await uow.chat.get_one(chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")

        cp_stmt = (
            select(ChatParticipant, User)
            .join(User, ChatParticipant.user_id == User.id)
            .where(ChatParticipant.chat_id == chat_id)
        )
        cp_res = await uow.session.execute(cp_stmt)
        participants = [
            AdminChatParticipantSchema(
                user_id=cp.user_id,
                username=u.username,
                email=u.email,
                role=cp.role.value if hasattr(cp.role, "value") else str(cp.role),
            )
            for cp, u in cp_res.all()
        ]

        msg_cnt_stmt = select(func.count(Message.id)).where(
            Message.chat_id == chat_id, Message.is_deleted == False
        )
        msg_cnt = (await uow.session.execute(msg_cnt_stmt)).scalar() or 0

        chat_dict = ChatSchemaFromBd.model_validate(chat).model_dump()
        chat_dict["participants"] = participants
        chat_dict["message_count"] = msg_cnt

        return Response(data=AdminChatDetailSchema.model_validate(chat_dict))


@admin.patch(
    "/chats/{chat_id}/",
    response_model=Response[ChatSchemaFromBd],
    name="[Админ] Изменить чат",
)
async def admin_patch_chat(
    chat_id: int,
    data: AdminChatPatch,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        chat = await uow.chat.get_one(chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")
        fields = data.model_dump(exclude_unset=True, exclude_none=True)
        if fields:
            stmt = (
                update(Chat)
                .where(Chat.id == chat_id)
                .values(**fields)
                .returning(Chat)
            )
            res = await uow.session.execute(stmt)
            chat = res.scalar_one()
        chat_for_return = UserSchemaFromBd.model_validate(chat)

        await uow.commit()
        return Response(data=chat_for_return)


@admin.delete(
    "/chats/{chat_id}/",
    response_model=Response[None],
    name="[Админ] Мягкое удаление чата",
)
async def admin_soft_delete_chat(
    chat_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        chat = await uow.chat.get_one(chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")
        stmt = update(Chat).where(Chat.id == chat_id).values(is_deleted=True)
        await uow.session.execute(stmt)
        await uow.commit()
        return Response(data=None)


@admin.delete(
    "/chats/{chat_id}/hard_delete/",
    response_model=Response[None],
    name="[Админ] Полное удаление чата из БД",
    description="⚠️ Необратимо. Удаляет чат, все сообщения и участников через CASCADE.",
)
async def admin_hard_delete_chat(
    chat_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        chat = await uow.chat.get_one(chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")
        stmt = delete(Chat).where(Chat.id == chat_id)
        await uow.session.execute(stmt)
        await uow.commit()
        return Response(data=None)


# ── Участники чата ─────────────────────────────────────────────────────────

@admin.get(
    "/chats/{chat_id}/participants/",
    response_model=Response[List[AdminChatParticipantSchema]],
    name="[Админ] Участники чата",
)
async def admin_get_participants(
    chat_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        chat = await uow.chat.get_one(chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")
        cp_stmt = (
            select(ChatParticipant, User)
            .join(User, ChatParticipant.user_id == User.id)
            .where(ChatParticipant.chat_id == chat_id)
        )
        cp_res = await uow.session.execute(cp_stmt)
        participants = [
            AdminChatParticipantSchema(
                user_id=cp.user_id,
                username=u.username,
                email=u.email,
                role=cp.role.value if hasattr(cp.role, "value") else str(cp.role),
            )
            for cp, u in cp_res.all()
        ]
        return Response(data=participants)


@admin.post(
    "/chats/{chat_id}/participants/",
    response_model=Response[None],
    name="[Админ] Добавить участника в чат",
)
async def admin_add_participant(
    chat_id: int,
    data: AdminAddParticipantSchema,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        chat = await uow.chat.get_one(chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")
        user = await uow.user.get_one(data.user_id)
        if not user:
            raise UnfoundEntity(detail="Пользователь не найден")
        existing = await uow.chat_participant.get_one_by(chat_id=chat_id, user_id=data.user_id)
        if existing:
            raise DuplicateEntity(detail="Пользователь уже в чате")
        await uow.chat_participant.add_one({"chat_id": chat_id, "user_id": data.user_id, "role": data.role})
        await uow.commit()
        return Response(data=None)


@admin.patch(
    "/chats/{chat_id}/participants/{user_id}/role/",
    response_model=Response[None],
    name="[Админ] Изменить роль участника",
)
async def admin_change_participant_role(
    chat_id: int,
    user_id: int,
    data: ChangeRoleSchema,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    role = data.role
    if role not in ("member", "admin", "owner"):
        raise EntityError(detail="Допустимые роли: member, admin, owner")
    async with uow as uow:
        cp = await uow.chat_participant.get_one_by(chat_id=chat_id, user_id=user_id)
        if not cp:
            raise UnfoundEntity(detail="Участник не найден")
        stmt = (
            update(ChatParticipant)
            .where(ChatParticipant.chat_id == chat_id, ChatParticipant.user_id == user_id)
            .values(role=role)
        )
        await uow.session.execute(stmt)
        await uow.commit()
        return Response(data=None)


@admin.delete(
    "/chats/{chat_id}/participants/{user_id}/",
    response_model=Response[None],
    name="[Админ] Исключить участника из чата",
)
async def admin_remove_participant(
    chat_id: int,
    user_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        cp = await uow.chat_participant.get_one_by(chat_id=chat_id, user_id=user_id)
        if not cp:
            raise UnfoundEntity(detail="Участник не найден в этом чате")
        await uow.chat_participant.delete(cp.id)
        await uow.commit()
        return Response(data=None)


# ── Сообщения чата ─────────────────────────────────────────────────────────

@admin.get(
    "/chats/{chat_id}/messages/",
    response_model=Response[List[AdminMessageSchema]],
    name="[Админ] Сообщения чата",
    description="Все сообщения, включая удалённые.",
)
async def admin_get_messages(
    chat_id: int,
    include_deleted: bool = Query(True),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        chat = await uow.chat.get_one(chat_id)
        if not chat:
            raise UnfoundEntity(detail="Чат не найден")
        stmt = select(Message).where(Message.chat_id == chat_id)
        if not include_deleted:
            stmt = stmt.where(Message.is_deleted == False)
        stmt = stmt.order_by(Message.id).offset(offset).limit(limit)
        res = await uow.session.execute(stmt)
        messages = res.scalars().all()
        return Response(data=[AdminMessageSchema.model_validate(m) for m in messages])


@admin.delete(
    "/chats/{chat_id}/messages/{message_id}/",
    response_model=Response[None],
    name="[Админ] Удалить сообщение (мягко)",
)
async def admin_delete_message(
    chat_id: int,
    message_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        msg = await uow.message.get_one(message_id)
        if not msg or msg.chat_id != chat_id:
            raise UnfoundEntity(detail="Сообщение не найдено")
        stmt = update(Message).where(Message.id == message_id).values(is_deleted=True)
        await uow.session.execute(stmt)
        await uow.commit()
        return Response(data=None)


@admin.delete(
    "/chats/{chat_id}/messages/{message_id}/hard_delete/",
    response_model=Response[None],
    name="[Админ] Полное удаление сообщения",
)
async def admin_hard_delete_message(
    chat_id: int,
    message_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        msg = await uow.message.get_one(message_id)
        if not msg or msg.chat_id != chat_id:
            raise UnfoundEntity(detail="Сообщение не найдено")
        stmt = delete(Message).where(Message.id == message_id)
        await uow.session.execute(stmt)
        await uow.commit()
        return Response(data=None)


# ══════════════════════════════════════════════════════════════════════════════
#  STATS / OVERVIEW
# ══════════════════════════════════════════════════════════════════════════════

@admin.get(
    "/stats/",
    response_model=Response[dict],
    name="[Админ] Общая статистика системы",
)
async def admin_stats(
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        total_users   = (await uow.session.execute(select(func.count(User.id)))).scalar()
        active_users  = (await uow.session.execute(select(func.count(User.id)).where(User.is_deleted == False))).scalar()
        superusers    = (await uow.session.execute(select(func.count(User.id)).where(User.is_superuser == True))).scalar()

        total_chats   = (await uow.session.execute(select(func.count(Chat.id)))).scalar()
        by_type = {}
        for ct in ChatType:
            cnt = (await uow.session.execute(
                select(func.count(Chat.id)).where(Chat.chat_type == ct, Chat.is_deleted == False)
            )).scalar()
            by_type[ct.value] = cnt

        total_messages = (await uow.session.execute(select(func.count(Message.id)))).scalar()
        active_messages = (await uow.session.execute(
            select(func.count(Message.id)).where(Message.is_deleted == False)
        )).scalar()

        return Response(data={
            "users": {
                "total": total_users,
                "active": active_users,
                "deleted": total_users - active_users,
                "superusers": superusers,
            },
            "chats": {
                "total": total_chats,
                "by_type": by_type,
            },
            "messages": {
                "total": total_messages,
                "active": active_messages,
                "deleted": total_messages - active_messages,
            },
        })


# ── Чаты конкретного пользователя ──────────────────────────────────────────

@admin.get(
    "/users/{user_id}/chats/",
    response_model=Response[List[AdminChatDetailSchema]],
    name="[Админ] Все чаты пользователя",
)
async def admin_user_chats(
    user_id: int,
    uow: IUnitOfWork = Depends(get_unit_of_work),
):
    async with uow as uow:
        user = await uow.user.get_one(user_id)
        if not user:
            raise UnfoundEntity(detail="Пользователь не найден")

        cp_stmt = select(ChatParticipant).where(ChatParticipant.user_id == user_id)
        cp_res = await uow.session.execute(cp_stmt)
        participations = cp_res.scalars().all()

        result = []
        for cp in participations:
            chat = await uow.chat.get_one(cp.chat_id)
            if not chat:
                continue

            all_cp_stmt = (
                select(ChatParticipant, User)
                .join(User, ChatParticipant.user_id == User.id)
                .where(ChatParticipant.chat_id == chat.id)
            )
            all_cp_res = await uow.session.execute(all_cp_stmt)
            participants = [
                AdminChatParticipantSchema(
                    user_id=p.user_id,
                    username=u.username,
                    email=u.email,
                    role=p.role.value if hasattr(p.role, "value") else str(p.role),
                )
                for p, u in all_cp_res.all()
            ]

            msg_cnt = (await uow.session.execute(
                select(func.count(Message.id)).where(Message.chat_id == chat.id, Message.is_deleted == False)
            )).scalar() or 0

            chat_dict = ChatSchemaFromBd.model_validate(chat).model_dump()
            chat_dict["participants"] = participants
            chat_dict["message_count"] = msg_cnt
            result.append(AdminChatDetailSchema.model_validate(chat_dict))

            return Response(data=result)