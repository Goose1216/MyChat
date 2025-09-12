import pytest
from httpx import AsyncClient
from app.security import security

@pytest.mark.parametrize(
    "payload, expected_status",
    [
        ({"username": "goose12161", "email": "goose@mail.ru", 'password': "Qwas1234", 'phone': "+79945250944"}, 200),
        ({"username": "user2", "email": "invalid-email", 'password': "Qwas1234", 'phone': "+79945250944"}, 422),
        ({"username": "user-with-invalid-phone", "email": "goose@mail.ru", 'password': "Qwas1234", 'phone': "+7994525094"}, 422),
        ({"username": "", "email": "goose@mail.ru", 'password': "Qwas1234", 'phone': "+79945250944"}, 422),
        ({"username": "user3", "email": "goose@mail.ru", 'password': "1234", 'phone': "+79945250944"}, 422),
        ({"username": "user@3", "email": "goose@mail.ru", 'password': "Qwas1234", 'phone': "+79945250944"}, 422),
        ({"invalid_data": 'test@mail.ru'}, 422),
    ]
)
@pytest.mark.asyncio
async def test_register(payload, expected_status, client):
    response = await client.post('/users/register', json=payload)
    assert response.status_code == expected_status
    data = response.json()
    if expected_status == 200:
        assert 'id' in data
        assert data['username'] == payload['username']

@pytest.mark.parametrize(
    "payload, expected_status, detail",
    [
        ({"username": "test_user", "email": "test@mail.ru", 'password': "Qwas1234", 'phone': "+79945250944"}, 409, 'User with this email already exists'),
        ({"username": "test_user", "email": "test_new@mail.ru", 'password': "Qwas1234", 'phone': "+79945250944"}, 409, 'User with this username already exists'),
        ({"username": "test_new_user", "email": "test@mail.ru", 'password': "Qwas1234", 'phone': "+79945250944"}, 409, 'User with this email already exists'),
        ({"username": "test_new_user", "email": "test_new@mail.ru", 'password': "Qwas1234", 'phone': "+79945250944"}, 409, 'User with this phone already exists'),
        ({"username": "test_new_user", "email": "test_new@mail.ru", 'password': "Qwas1234", 'phone': "+79945250941"}, 200, None),
    ]
)
@pytest.mark.asyncio
async def test_register_conflict_user(payload, expected_status, detail, client):
    payload_old = {"username": "test_user", "email": "test@mail.ru", 'password': "Qwas1234", 'phone': "+79945250944"}
    res = await client.post('/users/register', json=payload_old)
    assert res.status_code == 200

    res = await client.post('/users/register', json=payload)
    print(res.json().get('detail'))
    assert res.json().get('detail') == detail
    assert res.status_code == expected_status


@pytest.mark.parametrize(
    "payload, expected_status",
    [
        ({"username_or_email": 'test_user', 'password': "Qwas1234"}, 200),
        ({"username_or_email": 'test@mail.ru', 'password': "Qwas1234"}, 200),
        ({"username_or_email": 'test@mail.ru', 'password': "invalid_password"}, 401),
        ({"invalid_data": 'test@mail.ru'}, 422),
    ]
)
@pytest.mark.asyncio
async def test_login(payload, expected_status, client):
    payload_reg = {"username": "test_user", "email": "test@mail.ru", 'password': "Qwas1234", 'phone': "+79945250944"}
    res = await client.post('/users/register', json=payload_reg)
    assert res.status_code == 200

    response = await client.post('/users/login', json=payload)
    assert response.status_code == expected_status

@pytest.mark.asyncio
async def test_refresh_token_success_and_fail(client: AsyncClient):
    reg_payload = {"username": "refresh_user", "email": "refresh@mail.ru", "password": "Qwas1234", "phone": "+79945250944"}
    res = await client.post("/users/register", json=reg_payload)
    assert res.status_code == 200

    login_payload = {"username_or_email": "refresh_user", "password": "Qwas1234"}
    res = await client.post("/users/login", json=login_payload)
    assert res.status_code == 200
    tokens = res.json()
    refresh_token = tokens["refresh_token"]
    access_token = tokens["access_token"]

    headers = {"Authorization": f"Bearer {refresh_token}"}
    res_refresh = await client.post("/users/refresh_token", headers=headers)
    assert res_refresh.status_code == 200
    new_tokens = res_refresh.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens

    headers = {"Authorization": f"Bearer {access_token}"}
    res_wrong = await client.post("/users/refresh_token", headers=headers)
    assert res_wrong.status_code == 401
    assert res_wrong.json()["detail"] == "Not correct type token"

    fake_token = security.create_jwt_tokens({"user_id": 999, "username_or_email": "ghost", "session_id": "abc"})["access_token"]
    headers = {"Authorization": f"Bearer {fake_token}"}
    res_fake = await client.post("/users/refresh_token", headers=headers)
    assert res_fake.status_code == 401