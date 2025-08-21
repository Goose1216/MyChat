from pydantic import BaseModel, Field, EmailStr, validator
import re


class UserSchemaRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr = Field(description="Valid email address")
    phone: str = Field(
        pattern=r'^\+?[1-9]\d{1,14}$',
        description="Phone number in international format"
    )
    password: str

    @validator('phone')
    def validate_phone(cls, v):
        """Нормализация номера телефона"""
        v = re.sub(r'[\s\-\(\)]', '', v)
        
        if v.startswith('8'):
            v = '+7' + v[1:]
        
        if not v.startswith('+'):
            v = '+' + v
            
        return v


class UserSchemaFromBd(BaseModel):
    id: int
    username: str
    email: str
    phone: str

    class Config:
        from_attributes = True


class UserSchemaLogin(BaseModel):
    username_or_email: str
    password: str
