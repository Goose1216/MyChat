from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.app.endpoints.users import users
from app.app.endpoints.chats import chats

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users)
app.include_router(chats)

from app import errors