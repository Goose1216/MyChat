from pydantic_settings import BaseSettings


class Config(BaseSettings):
    DB_HOST: str
    DB_USERNAME: str
    DB_PASSWORD: str
    DB_NAME: str
    DB_PORT: str
    SECRET_KEY: str

    PROJECT_NAME: str

    FILE_STORAGE_PATH: str = "/files/"
    API_BASE_URL: str = "http://localhost:8000/"

    @property
    def ASYNC_DATABASE_URL(self):
        return f'postgresql+asyncpg://{self.DB_USERNAME}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}'

    @property
    def ASYNC_TEST_DATABASE_URL(self):
        return f'postgresql+asyncpg://{self.DB_USERNAME}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/test_{self.DB_NAME}'

    class Config:
        env_file = '.env'

settings = Config()