class EntityError(ValueError):
    http_status = 500

    def __init__(self, message=None, detail=None, num=0, path=None, status_code=None):
        self.message = message or detail
        #self.message = message
        self.num = num
        self.description = detail or message
        self.path = path
        self.http_status = status_code if status_code else self.http_status


class UnfoundEntity(EntityError):
    http_status = 404


class NotAuthenticated(EntityError):
    http_status = 401


class InaccessibleEntity(EntityError):
    http_status = 403


class UnprocessableEntity(EntityError):
    http_status = 422


class DuplicateEntity(EntityError):
    http_status = 409


class ListOfEntityError(ValueError):
    def __init__(self, errors: list[EntityError], description: str, http_status: int):
        self.errors = errors
        self.description = description
        self.http_status = http_status
