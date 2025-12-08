from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
import datetime

class UserSchemaRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr = Field(description="Емейл адресс")
    phone: str = Field(description="Номер телефона в международном формате")
    password: str


class UserSchemaFromBd(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    phone: str


class UserSchemaFromBdStatistic(UserSchemaFromBd):
    count_message: int | None = None
    count_message_in_this_chat: int | None = None


class UserSchemaPatch(BaseModel):
    username: str | None = None
    email: str | None = None
    phone: str | None = None


class UserChangePassword(BaseModel):
    new_password: str


class UserSchemaLogin(BaseModel):
    username_or_email: str
    password: str


class Tokens(BaseModel):
    access_token: str
    refresh_token: str
    expires_refresh_at: datetime.datetime
