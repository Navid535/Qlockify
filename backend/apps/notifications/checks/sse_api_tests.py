import json

from django.core.cache import cache
from django.http.response import StreamingHttpResponse
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.users.models import User


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class SSEAPIChecks(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(mobile="09120000001", password="StrongPass123")
        self.token_url = reverse("stream-token")
        self.stream_url = reverse("stream")

    def test_stream_token_requires_authentication(self):
        response = self.client.post(self.token_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stream_token_is_created_for_current_user(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.token_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertIn("expires_in", response.data)

        token = response.data["token"]
        cached_user_id = cache.get(f"notifications:sse:{token}")
        self.assertEqual(cached_user_id, str(self.user.id))

    def test_stream_rejects_invalid_token(self):
        response = self.client.get(self.stream_url, {"token": "invalid-token"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stream_returns_streaming_response_for_valid_token(self):
        self.client.force_authenticate(user=self.user)
        token_response = self.client.post(self.token_url)
        token = token_response.data["token"]

        response = self.client.get(self.stream_url, {"token": token})

        self.assertIsInstance(response, StreamingHttpResponse)
        self.assertIn("text/event-stream", response["Content-Type"])

    def test_stream_sends_notification_event(self):
        create_notification(user=self.user, title="Hello")

        self.client.force_authenticate(user=self.user)
        token_response = self.client.post(self.token_url)
        token = token_response.data["token"]

        response = self.client.get(self.stream_url, {"token": token})
        first_chunk = next(iter(response.streaming_content)).decode()

        self.assertIn("event: notification", first_chunk)
        self.assertIn("data:", first_chunk)

        payload_line = [line for line in first_chunk.splitlines() if line.startswith("data:")][0]
        payload = json.loads(payload_line[len("data:"):].strip())
        self.assertEqual(payload["title"], "Hello")

    def test_stream_token_shape(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.token_url)

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data["token"], str)
        self.assertTrue(response.data["token"])
        self.assertEqual(response.data["expires_in"], 300)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(set(response.data.keys()), {"token", "expires_in"})