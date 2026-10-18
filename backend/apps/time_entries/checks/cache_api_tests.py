from datetime import timedelta

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.time_entries.models import TimeEntry
from apps.users.models import User
from apps.workspaces.models import Workspace


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CacheApiChecks(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(mobile="09127770001", password="pass12345")
        self.workspace = Workspace.objects.create(name="Team", owner=self.user)
        self.start = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
        TimeEntry.objects.create(
            workspace=self.workspace,
            user=self.user,
            description="Initial work",
            start_time=self.start,
            end_time=self.start + timedelta(hours=1),
        )

    def test_timesheet_list_returns_cached_shape(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/time-entries/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("groups", response.json())

    def test_api_create_invalidates_cached_timesheet(self):
        self.client.force_authenticate(user=self.user)
        self.client.get("/api/time-entries/")
        response = self.client.post("/api/time-entries/", {
            "workspace": self.workspace.id,
            "description": "New work",
            "start_time": (self.start + timedelta(hours=2)).isoformat(),
            "end_time": (self.start + timedelta(hours=3)).isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 201)
        response = self.client.get("/api/time-entries/")
        self.assertEqual(response.json()["total_items"], 2)

    def test_user_cache_does_not_leak_between_users(self):
        other = User.objects.create_user(mobile="09127770002", password="pass12345")
        self.client.force_authenticate(user=self.user)
        self.client.get("/api/time-entries/")
        self.client.force_authenticate(user=other)
        response = self.client.get("/api/time-entries/")
        self.assertEqual(response.json()["total_items"], 0)

    def test_cached_filtered_response_keeps_its_query_scope(self):
        self.client.force_authenticate(user=self.user)
        all_response = self.client.get("/api/time-entries/")
        empty_response = self.client.get("/api/time-entries/", {"search": "missing"})
        self.assertEqual(all_response.json()["total_items"], 1)
        self.assertEqual(empty_response.json()["total_items"], 0)

    def test_api_delete_invalidates_cached_timesheet(self):
        entry = TimeEntry.objects.get(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.client.get("/api/time-entries/")
        response = self.client.delete(f"/api/time-entries/{entry.id}/")
        self.assertEqual(response.status_code, 204)
        response = self.client.get("/api/time-entries/")
        self.assertEqual(response.json()["total_items"], 0)
