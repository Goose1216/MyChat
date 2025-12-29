import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.app.endpoints.users import users
from app.app.endpoints.chats import chats
from app.app.endpoints.messages import messages
from app.core.config import settings
from app.logs.config import setup_logging, logger

ENV = os.getenv("ENVIRONMENT", "development")

setup_logging(ENV)


app = FastAPI(
    title=settings.PROJECT_NAME,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users)
app.include_router(chats)
app.include_router(messages)

from app import errors