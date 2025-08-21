from fastapi import FastAPI
from app.app.endpoints.users import users
from app.app.endpoints.chats import chats

app = FastAPI()

app.include_router(users)
app.include_router(chats)