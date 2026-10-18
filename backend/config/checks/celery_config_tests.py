from django.conf import settings
from django.test import SimpleTestCase


class CeleryConfigChecks(SimpleTestCase):
    def test_celery_app_imports(self):
        from config.celery import app
        self.assertEqual(app.main, 'quera_clock')

    def test_config_exports_celery_app(self):
        from config import celery_app
        self.assertIsNotNone(celery_app)

    def test_broker_url_uses_redis(self):
        self.assertEqual(settings.CELERY_BROKER_URL, 'redis://localhost:6379/0')

    def test_result_backend_uses_redis(self):
        self.assertEqual(settings.CELERY_RESULT_BACKEND, 'redis://localhost:6379/1')

    def test_development_settings_run_tasks_eagerly(self):
        self.assertTrue(settings.CELERY_TASK_ALWAYS_EAGER)