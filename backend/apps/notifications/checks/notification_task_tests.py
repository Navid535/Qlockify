from django.test import override_settings
from rest_framework.test import APITestCase

from apps.notifications.models import Notification
from apps.notifications.tasks import create_notification_task
from apps.users.models import User


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class NotificationTaskChecks(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(mobile="09120000001", password="StrongPass123")

    def test_task_creates_notification(self):
        create_notification_task(self.user.id, "Task Title", "Task Body")
        self.assertEqual(Notification.objects.count(), 1)
        notification = Notification.objects.first()
        self.assertEqual(notification.user, self.user)
        self.assertEqual(notification.title, "Task Title")

    def test_task_returns_notification_id(self):
        result = create_notification_task(self.user.id, "Task Title")
        notification = Notification.objects.get(id=result)
        self.assertEqual(notification.title, "Task Title")

    def test_task_stores_body(self):
        create_notification_task(self.user.id, "Task Title", "Some detailed body text")
        notification = Notification.objects.first()
        self.assertEqual(notification.body, "Some detailed body text")

    def test_task_delay_runs_in_development_eager_mode(self):
        create_notification_task.delay(self.user.id, "Delayed Title", "Delayed Body")
        self.assertEqual(Notification.objects.count(), 1)
        notification = Notification.objects.first()
        self.assertEqual(notification.title, "Delayed Title")

    def test_task_rejects_unknown_user(self):
        invalid_user_id = self.user.id + 9999
        with self.assertRaises(User.DoesNotExist):
            create_notification_task(invalid_user_id, "Should not exist")
        self.assertEqual(Notification.objects.count(), 0)