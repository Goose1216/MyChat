from typing import Any, Callable, Generic, Sequence, TypeVar

from pydantic import BaseModel, Field


class Paginator(BaseModel):
    page: int = Field(1, ge=1)
    total: int | None = Field(1, ge=0)
    has_prev: bool
    has_next: bool | None


class Error(BaseModel):
    code: int = Field(0, ge=0, title="Код ошибки")
    message: str = Field(0, title="Человеко-читаемое сообщение")
    path: str | None = Field(None, title="местоположение")
    additional: Any = Field(None, title="дополнительная информация")


Entity = TypeVar("Entity")


class Response(BaseModel, Generic[Entity]):
    """Стандартный контейнер запроса"""

    paginator: Paginator | None = Field(None)
    message: str = Field("Ok")
    description: str = Field("Выполнено")
    errors: list[Error] = Field([])
    data: Entity = Field(None)

    @staticmethod
    def create(
        paginator: Paginator | None = None,
        message: str | None = None,
        description: str | None = None,
        errors: list[Error] | None = None,
        data: Entity | None = None,
        mapper: Callable | None = None,
        mapper_extra_kwargs: dict[str, Any] | None = None,
    ):
        if mapper_extra_kwargs is None:
            mapper_extra_kwargs = {}

        if errors is None:
            errors = []

        if message is None:
            message = "Ok"
        if description is None:
            description = message

        adapted_data = None
        if mapper:
            if data is None:
                adapted_data = None
            elif isinstance(data, Sequence):
                adapted_data = [mapper(item, **mapper_extra_kwargs) for item in data]
            else:
                adapted_data = mapper(data, **mapper_extra_kwargs)
        else:
            adapted_data = data

        return Response(
            paginator=paginator,
            message=message,
            description=description,
            errors=errors,
            data=adapted_data,
        )
