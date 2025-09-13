import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_user(client):
    payload = {"username": "test_user", "email": "test@mail.ru", 'password': "Qwas1234", 'phone': "+79945250947"}
    res = await client.post('/users/register', json=payload)
    assert res.status_code == 200

@pytest_asyncio.fixture
async def headers(client):

    payload_login = {"username_or_email": 'test_user', 'password': "Qwas1234"}
    response = await client.post('/users/login', json=payload_login)
    assert response.status_code == 200

    tokens = response.json()
    access_token = tokens["access_token"]

    return {"Authorization": f"Bearer {access_token}"}

@pytest.mark.parametrize(
    "payload, expected_status",
    [
        ({"chat_type": "shared"}, 422),
        ({"chat_type": "channel"}, 422),
        ({"chat_type": "group"}, 422),
        ({"chat_type": "private"}, 422),
        ({"chat_type": "shared", "title": "test_chat"}, 200),
        ({"chat_type": "none", "title": "test_chat"}, 422),
        ({"chat_type": "private", "title": "test_chat"}, 422),
        #({"chat_type": "channel", "title": "test_chat"}, 200), проблема из-за асинхронности, возможно проблема в ОС
    ]
)
@pytest.mark.asyncio
async def test_create_chat(payload, expected_status, client, headers):
    response = await client.post("/chats/create", json=payload, headers=headers)
    assert response.status_code == expected_status

@pytest.mark.asyncio
async def test_create_chat_without_headers(client):
    response = await client.post("chats/create", json = {"chat_type": 'channel'})
    assert response.status_code == 401

