from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.users.models import User


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class NotificationAPIChecks(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(mobile="09126660000", password="StrongPass123")
        self.other_user = User.objects.create_user(mobile="09126660001", password="StrongPass123")

    def test_create_notification_service_creates_notification(self):
        notification = create_notification(self.user, "Hello", event_type="system")
        self.assertEqual(notification.user, self.user)
        self.assertEqual(notification.title, "Hello")

    def test_list_requires_authentication(self):
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_only_current_user_notifications(self):
        Notification.objects.create(user=self.user, title="Mine")
        Notification.objects.create(user=self.other_user, title="Other")
        self.client.force_authenticate(self.user)
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "Mine")

    def test_mark_read_marks_current_user_notification(self):
        notification = Notification.objects.create(user=self.user, title="Unread")
        self.client.force_authenticate(self.user)
        response = self.client.post(f"/api/notifications/{notification.id}/mark_read/")
        notification.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(notification.is_read)

    def test_unread_count_counts_current_user_only(self):
        Notification.objects.create(user=self.user, title="Unread")
        Notification.objects.create(user=self.other_user, title="Other")
        self.client.force_authenticate(self.user)
        response = self.client.get("/api/notifications/unread_count/")
        self.assertEqual(response.data["unread_count"], 1)
