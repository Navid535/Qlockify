from .base import *  # noqa: F403

import environ


env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
    EMAIL_PORT=(int, 587),
)

environ.Env.read_env(BASE_DIR / ".env.development", overwrite=True)

DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS")

CELERY_TASK_ALWAYS_EAGER = env("CELERY_TASK_ALWAYS_EAGER")
CELERY_TASK_EAGER_PROPAGATES = env("CELERY_TASK_EAGER_PROPAGATES")