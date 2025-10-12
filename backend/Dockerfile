FROM python:3.11-slim

WORKDIR /src/backend

COPY ./requirements.txt .

RUN pip install pip==23.3.2
RUN pip install -r requirements.txt

COPY . .

CMD ["alembic", "upgrade", "head"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]