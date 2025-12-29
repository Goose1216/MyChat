import logging
from fastapi import APIRouter, Depends

from app.services import MessageService, ChatService
from app.app import schemas
from app.utils.unit_of_work import UnitOfWork, IUnitOfWork
from app.security import security
from app.app.schemas.response import Response
from app.utils.response import get_responses_description_by_codes
from app.utils import manager, get_unit_of_work
from app.exceptions import NotAuthenticated, EntityError, UnfoundEntity, InaccessibleEntity

logger = logging.getLogger(__name__)

messages = APIRouter(
    tags=['Сообщения'],
    prefix='/messages',
)

@messages.put(
    "/{message_id}/",
    response_model=schemas.Response[schemas.MessageFromDbSchema],
    name="Обновить сообщение",
    description="Только для владельца этого сообщения",
    responses=get_responses_description_by_codes([401, 403, 404])
)
async def update_message(
                        message_id: int,
                        data: schemas.MessageUpdateSchema,
                        access_token = Depends(security.decode_jwt_access),
                        uow: IUnitOfWork = Depends(get_unit_of_work)
):
    chat_service = ChatService(uow)
    message_service = MessageService(uow)
    message = await message_service.get_one(pk=message_id)
    if message is None:
        raise UnfoundEntity(detail="Сообщение не найдено")

    if message.sender_id != int(access_token.get("user_id")):
        raise InaccessibleEntity(detail="Сообщение не принадлежит вам")

    message_for_return = await message_service.update(pk=message_id, data=data)
    members_chat = await chat_service.get_members(message.chat_id, return_id=True)

    await manager.broadcast(
        type_of_message=1,
        message_id=message_id,
        message=message_for_return.content,
        chat_id=message_for_return.chat_id,
        sender_id=message_for_return.sender_id,
        receivers_id=members_chat,
        created_at=message_for_return.created_at.isoformat(),
        updated_at=message_for_return.updated_at.isoformat(),
        sender=message_for_return.sender.model_dump(),
    )

    return schemas.Response(data=message_for_return)

@messages.delete(
    "/{message_id}/",
    response_model=schemas.Response[schemas.MessageFromDbSchema],
    name="Удалить сообщение",
    description="Только для владельца этого сообщения",
    responses=get_responses_description_by_codes([401, 403, 404])
)
async def delete_message(
                        message_id: int,
                        access_token = Depends(security.decode_jwt_access),
                        uow: IUnitOfWork = Depends(get_unit_of_work)
):
    chat_service = ChatService(uow)
    message_service = MessageService(uow)
    message = await message_service.get_one(pk=message_id)
    if message is None:
        raise UnfoundEntity(detail="Сообщение не найдено")

    if message.sender_id != int(access_token.get("user_id")):
        raise InaccessibleEntity(detail="Сообщение не принадлежит вам")

    message_for_return = await message_service.update(pk=message_id, data={"is_deleted": True})
    members_chat = await chat_service.get_members(message.chat_id, return_id=True)

    await manager.broadcast(
        type_of_message=2,
        message_id=message_id,
        message='Сообщение удалено',
        chat_id=message_for_return.chat_id,
        sender_id=message_for_return.sender_id,
        receivers_id=members_chat,
        is_deleted=message_for_return.is_deleted,
        created_at=message_for_return.created_at.isoformat(),
        updated_at=message_for_return.updated_at.isoformat(),
        sender=message_for_return.sender.model_dump(),
    )

    return schemas.Response(data=message_for_return)