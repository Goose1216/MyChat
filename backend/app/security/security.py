import datetime
import jwt
from typing import Dict

from passlib.context import CryptContext 
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/users/login')

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7 

def verify_hash(plain_str, hashed_str):
    return pwd_context.verify(plain_str, hashed_str)

def get_string_hash(string_for_hash):
    return pwd_context.hash(string_for_hash)

def create_jwt_tokens(data: Dict):
    try:
        to_encode_access = data.copy()

        expire_access = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        expire_access = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=10)
        to_encode_access.update({"exp": expire_access, "type": "access"})
        access_token = jwt.encode(to_encode_access, SECRET_KEY, algorithm=ALGORITHM)

        to_encode_refresh = data.copy()
        expire_refresh = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode_refresh.update({"exp": expire_refresh, "type": "refresh"})
        refresh_token = jwt.encode(to_encode_refresh, SECRET_KEY, algorithm=ALGORITHM)

        return {"access_token": access_token, 'refresh_token': refresh_token, 'expires_refresh_at': expire_refresh}
    except jwt.PyJWTError as e:
        # здесь можно добавить логирование
        print(e)
        return None

async def decode_jwt(token: str = Depends(oauth2_scheme)):
    try:
        decode = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        decode.update({"raw": token})
        return decode
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,  detail="Token time expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,  detail="Invalid credentials")

