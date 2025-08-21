from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
import phonenumbers
import re


class UserSchemaRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr = Field(description="Valid email address")
    phone: str = Field(description="Phone number in international format")
    password: str

    @field_validator('phone')
    def validate_phone(cls, v: str) -> str:
        try:
            parsed = phonenumbers.parse(v, "RU")

            if not phonenumbers.is_possible_number(parsed):
                raise ValueError("Invalid number phone")

            if not phonenumbers.is_valid_number(parsed):
                raise ValueError("Invalid number phone")

            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

        except Exception:
            raise ValueError("Invalid number phone")

    @field_validator("username")
    def validate_username(cls, v: str) -> str:
        if not re.match(r"^[A-Za-z0-9_]+$", v):
            raise ValueError("Username can only contain Latin letters, digits, and '_'")
        return v

    @field_validator("password")
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must contain at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        return v


class UserSchemaFromBd(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    phone: str


class UserSchemaLogin(BaseModel):
    username_or_email: str
    password: str
