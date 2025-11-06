from app.main import app
from app.app.schemas.response import Error, Response
from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .exceptions import EntityError, ListOfEntityError

default_error_description = {
    400: "Невалидные данные",
    401: "Войдите в приложение ещё раз",
    403: "Войдите в приложение ещё раз",
    404: "Не найдено",
    409: "Объект уже существует в БД",
    422: "Некорректные данные",
    500: "Внутренняя ошибка сервера",
}


@app.exception_handler(RequestValidationError)
def validation_exception_handler(request, exc: RequestValidationError):
    errors = []

    for er in exc.errors():
        errors.append(
            Error(
                message=er["msg"],
                path=".".join(str(p) for p in er["loc"])
                if er["type"] != "value_error.jsondecode"
                else "body",
            )
        )

    return JSONResponse(
        status_code=400,
        content=(
            Response(
                message="Validation Error",
                errors=errors,
                description=default_error_description.get(400, "Невалидные данные"),
            )
        ).model_dump(),
    )


@app.exception_handler(StarletteHTTPException)
def http_exception_handler(request: Request, exc: StarletteHTTPException):
    errors = [
        Error(
            message=exc.detail,
            path=None if exc.status_code not in {401, 403} else "header",
        )
    ]

    return JSONResponse(
        status_code=exc.status_code,
        content=(
            Response(
                message="Error",
                errors=errors,
                description=default_error_description.get(exc.status_code, "Ошибка"),
            )
        ).model_dump(),
    )


@app.exception_handler(EntityError)
def entity_error_handler(request: Request, exc: EntityError):
    return JSONResponse(
        status_code=exc.http_status,
        content=(
            Response(
                message="Error",
                errors=[Error(code=exc.num, message=exc.message)],
                description=exc.message,
            )
        ).model_dump(),
    )


@app.exception_handler(ListOfEntityError)
def list_entity_error_handler(request: Request, exc: ListOfEntityError):
    return JSONResponse(
        status_code=exc.http_status,
        content=(
            Response(
                message="Error",
                errors=[
                    Error(
                        code=exc_item.num, message=exc_item.message, path=exc_item.path
                    )
                    for exc_item in exc.errors
                ],
                description=exc.description,
            )
        ).model_dump(),
    )


@app.exception_handler(500)
async def internal_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=jsonable_encoder(
            {
                "code": 500,
                "msg": exc.args,
                "exc": exc,
            }
        ),
    )