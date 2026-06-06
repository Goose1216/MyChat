#!/usr/bin/env python3
"""
seed_db.py — заполнение базы данных MyChat тестовыми данными.

Запуск:
  Windows:  python seed_db.py
  macOS:    python3 seed_db.py

Требования: pip install psycopg2-binary passlib (или bcrypt)

Что создаётся:
  - 1 суперпользователь  (admin / admin123)
  - 6 обычных пользователей
  - 5 чатов разных типов (2 группы, 2 канала, 1 приватный)
  - по 10 сообщений в каждом чате от разных участников
  - по 2 задачи в каждом чате с разными статусами и приоритетами
"""

import os
import sys
import uuid
import random
import hashlib
import datetime
import argparse

# ── Зависимости ───────────────────────────────────────────────────────────────
try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("Установите psycopg2:  pip install psycopg2-binary")
    sys.exit(1)

try:
    from passlib.context import CryptContext
    import warnings
    warnings.filterwarnings("ignore", ".*__about__.*")
    _ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def hash_password(pw: str) -> str:
        return _ctx.hash(pw)
except ImportError:
    # Запасной вариант — bcrypt напрямую
    try:
        import bcrypt
        def hash_password(pw: str) -> str:
            return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    except ImportError:
        print("Установите хэшер:  pip install passlib  или  pip install bcrypt")
        sys.exit(1)

# ── Настройки подключения (можно переопределить через env или аргументы CLI) ──

DEFAULT_DSN = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     int(os.getenv("DB_PORT", "5432")),
    "dbname":   os.getenv("DB_NAME",     "mychat"),
    "user":     os.getenv("DB_USER",     "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}

# ── Данные для заполнения ─────────────────────────────────────────────────────

USERS = [
    {"username": "admin",       "email": "admin@corp.ru",       "phone": "+79000000001", "password": "admin123",   "is_superuser": True},
    {"username": "mikhail",     "email": "mikhail@corp.ru",     "phone": "+79000000002", "password": "Pass123!",   "is_superuser": False},
    {"username": "anna",        "email": "anna@corp.ru",        "phone": "+79000000003", "password": "Pass123!",   "is_superuser": False},
    {"username": "dmitry",      "email": "dmitry@corp.ru",      "phone": "+79000000004", "password": "Pass123!",   "is_superuser": False},
    {"username": "ekaterina",   "email": "ekaterina@corp.ru",   "phone": "+79000000005", "password": "Pass123!",   "is_superuser": False},
    {"username": "sergey",      "email": "sergey@corp.ru",      "phone": "+79000000006", "password": "Pass123!",   "is_superuser": False},
    {"username": "olga",        "email": "olga@corp.ru",        "phone": "+79000000007", "password": "Pass123!",   "is_superuser": False},
]

CHATS = [
    {
        "chat_type": "GROUP",
        "title": "Отдел разработки",
        "description": "Обсуждение задач команды разработки",
        "members": ["mikhail", "anna", "dmitry", "ekaterina"],
        "owner": "mikhail",
    },
    {
        "chat_type": "GROUP",
        "title": "HR и административные вопросы",
        "description": "Кадровые вопросы и объявления",
        "members": ["admin", "olga", "anna", "sergey"],
        "owner": "olga",
    },
    {
        "chat_type": "CHANNEL",
        "title": "Новости компании",
        "description": "Официальные объявления руководства",
        "members": ["admin", "mikhail", "anna", "dmitry", "ekaterina", "sergey", "olga"],
        "owner": "admin",
    },
    {
        "chat_type": "CHANNEL",
        "title": "Технические обновления",
        "description": "Обновления инфраструктуры и деплои",
        "members": ["mikhail", "dmitry", "ekaterina", "sergey"],
        "owner": "dmitry",
    },
    {
        "chat_type": "PRIVATE",
        "title": None,
        "description": None,
        "members": ["mikhail", "anna"],
        "owner": "mikhail",
    },
]

MESSAGES_POOL = [
    "Привет всем! Как дела с задачами?",
    "Я закончил свою часть, можно ревьюить.",
    "Нужна помощь с настройкой окружения.",
    "Встреча в 15:00, не забудьте подключиться.",
    "Обновил документацию в confluence.",
    "Баг в продакшене! Кто может посмотреть?",
    "Деплой прошёл успешно, всё работает.",
    "Кто берёт задачу по рефакторингу API?",
    "Отчёт за неделю отправил на почту.",
    "Тесты упали на CI, разбираюсь.",
    "Обновите зависимости до последней версии.",
    "Провёл code review, оставил комментарии.",
    "Новая версия готова к тестированию.",
    "Завтра presentation заказчику, готовимся.",
    "Добавил логирование в модуль авторизации.",
    "Кто настраивал nginx? Есть вопрос по конфигу.",
    "Закрыл 3 задачи из спринта, отмечайте.",
    "Оценки для следующего спринта выставлены.",
    "Прошу всех заполнить таймшит до пятницы.",
    "Пул реквест отправил, жду апрув.",
]

TASKS_POOL = [
    {
        "title": "Рефакторинг модуля аутентификации",
        "description": "Вынести логику JWT в отдельный сервис, добавить unit-тесты.",
        "priority": "HIGH",
        "status": "IN_PROGRESS",
    },
    {
        "title": "Настройка CI/CD pipeline",
        "description": "Настроить автоматический деплой на staging при мердже в develop.",
        "priority": "CRITICAL",
        "status": "NEW",
    },
    {
        "title": "Написать документацию API",
        "description": "Покрыть все эндпоинты описанием в Swagger и добавить примеры запросов.",
        "priority": "MEDIUM",
        "status": "DONE",
    },
    {
        "title": "Исправить баг с загрузкой файлов",
        "description": "При загрузке файлов > 10MB падает 500 ошибка. Разобраться и починить.",
        "priority": "CRITICAL",
        "status": "IN_PROGRESS",
    },
    {
        "title": "Оптимизация SQL-запросов",
        "description": "Добавить индексы на таблицы messages и chat_participants.",
        "priority": "MEDIUM",
        "status": "DONE",
    },
    {
        "title": "Обновить зависимости проекта",
        "description": "Обновить все пакеты до последних стабильных версий, проверить совместимость.",
        "priority": "LOW",
        "status": "NEW",
    },
    {
        "title": "Добавить поддержку тёмной темы",
        "description": "Реализовать переключатель темы в настройках пользователя.",
        "priority": "LOW",
        "status": "CANCELLED",
    },
    {
        "title": "Провести нагрузочное тестирование",
        "description": "Протестировать WebSocket-соединения при 500+ одновременных пользователях.",
        "priority": "HIGH",
        "status": "NEW",
    },
    {
        "title": "Миграция на PostgreSQL 16",
        "description": "Обновить версию СУБД, проверить совместимость всех миграций.",
        "priority": "MEDIUM",
        "status": "IN_PROGRESS",
    },
    {
        "title": "Реализовать push-уведомления",
        "description": "Интегрировать Firebase Cloud Messaging для мобильных уведомлений.",
        "priority": "HIGH",
        "status": "NEW",
    },
]


def now_plus(days: int = 0, hours: int = 0, minutes: int = 0) -> str:
    """Возвращает ISO-строку смещённого времени."""
    dt = datetime.datetime.utcnow() + datetime.timedelta(days=days, hours=hours, minutes=minutes)
    return dt.isoformat()


def seed(dsn: dict, clear: bool = False) -> None:
    print(f"\n{'='*55}")
    print(f"  MyChat — заполнение базы данных")
    print(f"  Хост: {dsn['host']}:{dsn['port']}  БД: {dsn['dbname']}")
    print(f"{'='*55}\n")

    conn = psycopg2.connect(**dsn)
    conn.autocommit = False
    cur = conn.cursor()

    # ── Опциональная очистка ──────────────────────────────────────────────────
    if clear:
        print("⚠  Очищаем таблицы...")
        tables = [
            "message_read_batches", "task_assignments", "tasks",
            "files", "messages", "chat_participants", "private_chats",
            "chats", "refresh_tokens", "users",
        ]
        for t in tables:
            cur.execute(f"TRUNCATE TABLE {t} RESTART IDENTITY CASCADE;")
        conn.commit()
        print("   Таблицы очищены.\n")

    # ── 1. Пользователи ───────────────────────────────────────────────────────
    print("👤 Создаём пользователей...")
    user_ids: dict[str, int] = {}

    for u in USERS:
        # Проверяем — вдруг уже существует
        cur.execute("SELECT id FROM users WHERE username = %s OR email = %s;", (u["username"], u["email"]))
        row = cur.fetchone()
        if row:
            user_ids[u["username"]] = row[0]
            print(f"   ↩  {u['username']} уже существует (id={row[0]}), пропускаем.")
            continue

        hashed = hash_password(u["password"])
        is_superuser = u.get("is_superuser", False)

        # Проверяем наличие колонки is_superuser (может не быть если миграция не запускалась)
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='is_superuser';
        """)
        has_superuser_col = cur.fetchone() is not None

        if has_superuser_col:
            cur.execute("""
                INSERT INTO users (username, email, phone, password, is_verified, is_deleted, is_superuser, created_at)
                VALUES (%s, %s, %s, %s, true, false, %s, NOW())
                RETURNING id;
            """, (u["username"], u["email"], u["phone"], hashed, is_superuser))
        else:
            cur.execute("""
                INSERT INTO users (username, email, phone, password, is_verified, is_deleted, created_at)
                VALUES (%s, %s, %s, %s, true, false, NOW())
                RETURNING id;
            """, (u["username"], u["email"], u["phone"], hashed))

        uid = cur.fetchone()[0]
        user_ids[u["username"]] = uid
        role_label = " 👑 суперпользователь" if is_superuser else ""
        print(f"   ✔  {u['username']} (id={uid}){role_label}")

    conn.commit()

    # ── 2. Чаты, участники, сообщения, задачи ─────────────────────────────────
    print(f"\n💬 Создаём {len(CHATS)} чатов...\n")
    task_pool_idx = 0

    for chat_cfg in CHATS:
        chat_type = chat_cfg["chat_type"]
        title     = chat_cfg["title"]
        members   = [m for m in chat_cfg["members"] if m in user_ids]
        owner     = chat_cfg["owner"]

        # Создаём чат — передаём значение без явного cast, PG приведёт сам
        cur.execute("""
            INSERT INTO chats (chat_type, title, description, is_deleted, created_at)
            VALUES (%s::chattype, %s, %s, false, NOW())
            RETURNING id;
        """, (chat_type, title, chat_cfg["description"]))
        chat_id = cur.fetchone()[0]
        print(f"  💬 [{chat_type}] {title or 'Приватный чат'} (id={chat_id})")

        # Для приватного чата — запись в private_chats
        if chat_type == "PRIVATE" and len(members) >= 2:
            uid1 = user_ids[members[0]]
            uid2 = user_ids[members[1]]
            try:
                cur.execute("""
                    INSERT INTO private_chats (chat_id, user1_id, user2_id)
                    VALUES (%s, %s, %s);
                """, (chat_id, uid1, uid2))
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                print(f"     ↩  Приватный чат между {members[0]} и {members[1]} уже существует, пропускаем.")
                continue

        # Участники
        for username in members:
            uid  = user_ids[username]
            role = "OWNER" if username == owner else ("ADMIN" if random.random() < 0.25 else "MEMBER")
            try:
                cur.execute("""
                    INSERT INTO chat_participants (chat_id, user_id, role, last_read_message_id)
                    VALUES (%s, %s, %s::userrole, 0);
                """, (chat_id, uid, role))
            except psycopg2.errors.UniqueViolation:
                conn.rollback()

        conn.commit()
        print(f"     👥 {len(members)} участников добавлено")

        # Сообщения (10 штук от разных участников)
        print(f"     ✉  Добавляем 10 сообщений...")
        message_ids = []
        messages_texts = random.sample(MESSAGES_POOL, min(10, len(MESSAGES_POOL)))

        for i, text in enumerate(messages_texts):
            sender_username = members[i % len(members)]
            sender_id = user_ids[sender_username]
            cur.execute("""
                INSERT INTO messages (chat_id, sender_id, content, is_deleted, created_at, updated_at)
                VALUES (%s, %s, %s, false, NOW() + interval '%s minutes', NOW() + interval '%s minutes')
                RETURNING id;
            """, (chat_id, sender_id, text, i * 3, i * 3))
            msg_id = cur.fetchone()[0]
            message_ids.append(msg_id)

        conn.commit()

        # Задачи (2 задачи на чат, привязанные к разным сообщениям)
        print(f"     📋 Добавляем 2 задачи...")
        for j in range(2):
            task_data = TASKS_POOL[task_pool_idx % len(TASKS_POOL)]
            task_pool_idx += 1

            task_id     = str(uuid.uuid4())
            creator_uid = user_ids[owner]
            # Привязываем к первому и второму сообщению
            linked_msg_id = message_ids[j] if j < len(message_ids) else None
            priority    = task_data["priority"]
            status      = task_data["status"]

            cur.execute("""
                INSERT INTO tasks (id, title, description, creator_id, chat_id, message_id,
                                   priority, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s::task_priority_enum, %s::task_status_enum, NOW(), NOW());
            """, (
                task_id, task_data["title"], task_data["description"],
                creator_uid, chat_id, linked_msg_id,
                priority, status,
            ))

            # Назначаем исполнителей (1-2 участника)
            assignees = random.sample(
                [user_ids[m] for m in members if m != owner],
                min(2, max(1, len(members) - 1))
            )
            for assignee_id in assignees:
                assignment_status = status
                cur.execute("""
                    INSERT INTO task_assignments (task_uuid, user_id, status)
                    VALUES (%s, %s, %s::task_status_enum);
                """, (task_id, assignee_id, assignment_status))

            print(f"        ✔  [{priority}] {task_data['title'][:45]}… ({status})")

        conn.commit()

    # ── 3. Итог ────────────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM users;")
    total_users = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM chats;")
    total_chats = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM messages;")
    total_msgs = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tasks;")
    total_tasks = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"""
{'='*55}
  ✅ Готово!

  Пользователей в БД:  {total_users}
  Чатов в БД:          {total_chats}
  Сообщений в БД:      {total_msgs}
  Задач в БД:          {total_tasks}

  Войти как суперпользователь:
    Логин:    admin
    Пароль:   admin123

  Обычные пользователи (пароль: Pass123!):
    mikhail / anna / dmitry / ekaterina / sergey / olga
{'='*55}
""")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Заполнение БД MyChat тестовыми данными",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  python seed_db.py
  python seed_db.py --host localhost --port 5432 --dbname mychat
  python seed_db.py --clear
  python seed_db.py --host 127.0.0.1 --user myuser --password mypass --dbname mydb
  DB_HOST=db DB_PASSWORD=secret python seed_db.py
        """
    )
    parser.add_argument("--host",     default=DEFAULT_DSN["host"],     help="Хост PostgreSQL")
    parser.add_argument("--port",     default=DEFAULT_DSN["port"],     type=int, help="Порт PostgreSQL")
    parser.add_argument("--dbname",   default=DEFAULT_DSN["dbname"],   help="Имя базы данных")
    parser.add_argument("--user",     default=DEFAULT_DSN["user"],     help="Пользователь БД")
    parser.add_argument("--password", default=DEFAULT_DSN["password"], help="Пароль БД")
    parser.add_argument("--clear",    action="store_true",             help="Очистить таблицы перед заполнением")

    args = parser.parse_args()

    dsn = {
        "host":     args.host,
        "port":     args.port,
        "dbname":   args.dbname,
        "user":     args.user,
        "password": args.password,
    }

    try:
        seed(dsn, clear=args.clear)
    except psycopg2.OperationalError as e:
        print(f"\n❌ Не удалось подключиться к PostgreSQL:\n   {e}")
        print("\nПроверьте параметры подключения или запустите с --help")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()