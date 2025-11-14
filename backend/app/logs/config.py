import logging
import sys
import json
from logging.config import dictConfig
from typing import Any, Dict


class CustomJsonFormatter(logging.Formatter):
    """Кастомный JSON formatter для структурированных логов"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process": record.process,
            "thread": record.threadName,
        }

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        if hasattr(record, "extra") and record.extra:
            log_entry.update(record.extra)

        return json.dumps(log_entry, ensure_ascii=False)


def get_logging_config(env: str = "development") -> Dict[str, Any]:
    """Возвращает конфигурацию логирования без файлов"""

    common_handlers = {
        "console": {
            "class": "logging.StreamHandler",
            "level": "DEBUG",
            "formatter": "default" if env == "development" else "json",
            "stream": sys.stdout,
        }
    }

    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s [%(levelname)-8s] %(name)-20s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "json": {
                "()": CustomJsonFormatter,
                "datefmt": "%Y-%m-%dT%H:%M:%S%z",
            },
            "access": {
                "format": '%(asctime)s - %(client_addr)s - "%(request_line)s" %(status_code)d',
                "datefmt": "%Y-%m-%d %H:%M:%S%z",
            },
        },
        "handlers": common_handlers,
        "loggers": {
            "app": {
                "handlers": ["console"],
                "level": "DEBUG" if env == "development" else "WARNING",
                "propagate": False,
            },
            "uvicorn": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
                "formatter": "access",
            },
            "uvicorn.error": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            },
            "sqlalchemy.engine": {
                "handlers": ["console"],
                "level": "WARNING",
                "propagate": False,
            },
            "sqlalchemy.pool": {
                "handlers": ["console"],
                "level": "WARNING",
                "propagate": False,
            },
            "fastapi": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            },
        },
        "root": {
            "handlers": ["console"],
            "level": "WARNING",
        },
    }

    return config


def setup_logging(env: str = "development"):
    try:
        config = get_logging_config(env)
        dictConfig(config)

        logger = logging.getLogger("app")
        logger.info("Logging configured successfully for environment: %s", env)

    except Exception as e:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            handlers=[logging.StreamHandler(sys.stdout)],
        )
        fallback_logger = logging.getLogger("app")
        fallback_logger.error("Failed to configure logging: %s", e)


logger = logging.getLogger("app")
