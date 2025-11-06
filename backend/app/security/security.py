import datetime
import jwt
import phonenumbers
import re
from typing import Dict

from passlib.context import CryptContext 
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status

from app.core.config import settings
from app.app.schemas import Tokens
from app.exceptions import NotAuthenticated, InaccessibleEntity, UnprocessableEntity, EntityError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/users/login/swagger/')

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
access_TOKEN_EXPIRE_DAYS_FOR_SWAGGER = 1

def verify_hash(plain_str, hashed_str):
    return pwd_context.verify(plain_str, hashed_str)

def get_string_hash(string_for_hash):
    return pwd_context.hash(string_for_hash)

def create_jwt_for_swagger(data: Dict):
    try:
        to_encode_access = data.copy()

        expire_access = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=access_TOKEN_EXPIRE_DAYS_FOR_SWAGGER)
        to_encode_access.update({"exp": expire_access, "type": "access"})
        access_token = jwt.encode(to_encode_access, SECRET_KEY, algorithm=ALGORITHM)

        return {
                  "access_token": access_token,
                  "token_type": "bearer"
                }

    except jwt.PyJWTError as e:
        # здесь можно добавить логирование
        print(e)
        return None

def create_jwt_tokens(data: Dict):
    try:
        to_encode_access = data.copy()

        expire_access = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode_access.update({"exp": expire_access, "type": "access"})
        access_token = jwt.encode(to_encode_access, SECRET_KEY, algorithm=ALGORITHM)

        to_encode_refresh = data.copy()
        expire_refresh = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode_refresh.update({"exp": expire_refresh, "type": "refresh"})
        refresh_token = jwt.encode(to_encode_refresh, SECRET_KEY, algorithm=ALGORITHM)

        return {"access_token": access_token, 'refresh_token': refresh_token, 'expires_refresh_at': expire_refresh}
    except jwt.PyJWTError as e:
        print(e)
        return None

async def decode_jwt_access(token: str = Depends(oauth2_scheme)):
    try:
        decode = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        decode.update({"raw": token})
        if decode['type'] != 'access':
            raise NotAuthenticated(detail="Неверный тип токена")
        return decode
    except jwt.ExpiredSignatureError:
        raise NotAuthenticated(detail="Токен истёк")
    except jwt.InvalidTokenError:
        raise NotAuthenticated(detail="Неверный токен")

async def decode_jwt_refresh(token: str = Depends(oauth2_scheme)):
    try:
        decode = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        decode.update({"raw": token})
        if decode['type'] != 'refresh':
            raise NotAuthenticated(detail="Неверный тип токена")
        return decode
    except jwt.ExpiredSignatureError:
        raise NotAuthenticated(detail="Токен истёк")
    except jwt.InvalidTokenError:
        raise NotAuthenticated(detail="Неверный токен")

def validate_phone(v: str):
    parsed = phonenumbers.parse(v, "RU")

    if not phonenumbers.is_possible_number(parsed):
        raise UnprocessableEntity(detail="Неверный номер телефона")

    if not phonenumbers.is_valid_number(parsed):
        raise UnprocessableEntity(detail="Неверный номер телефона")

    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

def validate_username(v: str) -> str:
    if not re.match(r"^[A-Za-z0-9_]+$", v):
        raise UnprocessableEntity(
            detail="Логин может содержать только латинские буквы, цифры, и '_' "
        )
    return v

def validate_password(v: str) -> str:
    if len(v) < 8:
        raise UnprocessableEntity(
            detail="Пароль должен содержать как минимум 8 символов"
        )
    if not re.search(r"[A-Z]", v):
        raise UnprocessableEntity(
            detail="Пароль должен содержать как минимум один символ в верхнем регистре"
        )
    if not re.search(r"[a-z]", v):
        raise UnprocessableEntity(
            detail="Пароль должен содержать как минимум один символ в нижнем регистре"
        )
    return v
