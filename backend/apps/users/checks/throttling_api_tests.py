from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.users.api.throttles import AuthRateThrottle
from apps.users.api.views import LoginAPIView, RegisterAPIView
from apps.users.models import User


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ThrottlingAPIChecks(APITestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_auth_throttle_scope_is_auth(self):
        self.assertEqual(AuthRateThrottle.scope, "auth")

    def test_register_view_uses_auth_throttle(self):
        self.assertIn(AuthRateThrottle, RegisterAPIView.throttle_classes)

    def test_login_view_uses_auth_throttle(self):
        self.assertIn(AuthRateThrottle, LoginAPIView.throttle_classes)

    def test_auth_throttle_rate_is_configured(self):
        self.assertEqual(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["auth"], "10/minute")

    def test_login_is_throttled_after_limit(self):
        User.objects.create_user(mobile="09123334444", password="StrongPass123")
        payload = {"mobile": "09123334444", "password": "WrongPass123"}
        for _ in range(10):
            self.client.post("/api/users/login/", payload, format="json")
        response = self.client.post("/api/users/login/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
