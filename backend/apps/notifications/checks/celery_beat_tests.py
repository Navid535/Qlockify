from django.conf import settings
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.notifications.models import Notification
from apps.notifications.tasks import cleanup_read_notifications
from apps.users.models import User


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CeleryBeatChecks(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(mobile="09120000001", password="StrongPass123")

    def test_cleanup_task_soft_deletes_old_read_notifications(self):
        notification = Notification.objects.create(
            user=self.user, title="Old Read", is_read=True
        )
        old_time = timezone.now() - timezone.timedelta(days=40)
        Notification.objects.filter(id=notification.id).update(updated_at=old_time)

        cleanup_read_notifications()

        self.assertFalse(Notification.objects.filter(id=notification.id).exists())

    def test_cleanup_task_keeps_unread_notifications(self):
        notification = Notification.objects.create(
            user=self.user, title="Old Unread", is_read=False
        )
        old_time = timezone.now() - timezone.timedelta(days=40)
        Notification.objects.filter(id=notification.id).update(updated_at=old_time)

        cleanup_read_notifications()

        self.assertTrue(Notification.objects.filter(id=notification.id).exists())

    def test_cleanup_task_returns_deleted_count(self):
        notification = Notification.objects.create(
            user=self.user, title="Old Read", is_read=True
        )
        old_time = timezone.now() - timezone.timedelta(days=40)
        Notification.objects.filter(id=notification.id).update(updated_at=old_time)

        result = cleanup_read_notifications()

        self.assertEqual(result, 1)

    def test_beat_schedule_is_registered(self):
        self.assertIn("cleanup-read-notifications", settings.CELERY_BEAT_SCHEDULE)

    def test_beat_schedule_points_to_cleanup_task(self):
        entry = settings.CELERY_BEAT_SCHEDULE["cleanup-read-notifications"]
        self.assertEqual(entry["task"], "apps.notifications.tasks.cleanup_read_notifications")