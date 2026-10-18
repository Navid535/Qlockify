import multiprocessing
import os

bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")

workers = int(
    os.getenv(
        "GUNICORN_WORKERS",
        multiprocessing.cpu_count() * 2 + 1,
    )
)

worker_class = os.getenv("GUNICORN_WORKER_CLASS", "gthread")
threads = int(os.getenv("GUNICORN_THREADS", 2))

timeout = int(os.getenv("GUNICORN_TIMEOUT", 120))
keepalive = 5
graceful_timeout = 30

accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

access_log_format = (
    '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s '
    '"%(f)s" "%(a)s" %(D)s'
)

max_requests = 1000
max_requests_jitter = 50

preload_app = True

worker_tmp_dir = "/dev/shm"