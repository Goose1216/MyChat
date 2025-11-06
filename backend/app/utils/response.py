from app.app.schemas.response import Response


def get_responses_description_by_codes(
    codes: list[int],
):
    all_titles = {
        400: "Переданы невалидные данные",
        401: "Ошибка авторизации",
        403: "Отказано в доступе",
        404: "Не найдено",
        422: "Переданы некорректные данные",
        500: "Ошибка сервера",
        502: "Ошибка прокси",
    }
    codes.append(422)
    codes.append(500)
    codes.append(502)
    codes = list(set(codes))
    responses = {}
    for code in codes:
        responses[code] = {
            "model": Response[None],
            "description": all_titles.get(code, f"Error {code}"),
        }
    return responses