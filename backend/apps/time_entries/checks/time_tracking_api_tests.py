from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.tags.models import Tag
from apps.time_entries.models import TimeEntry
from apps.users.models import User
from apps.workspaces.models import Workspace, WorkspaceMembership


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class TimeTrackingApiChecks(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            mobile="09120000001",
            password="password",
        )

        self.other_user = User.objects.create_user(
            mobile="09120000002",
            password="password",
        )

        self.workspace = Workspace.objects.create(
            name="Main Workspace",
            owner=self.user,
        )

        WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.other_user,
            role=WorkspaceMembership.Role.MEMBER,
        )

    def test_start_action_creates_running_entry(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/time-entries/start/",
            {
                "workspace": self.workspace.id,
            },
        )
        self.assertEqual(response.status_code, 201)

        entry = TimeEntry.objects.get(
            workspace=self.workspace,
            user=self.user,
        )

        self.assertIsNone(entry.end_time)

    def test_running_action_returns_current_timer(self):
        self.client.force_authenticate(user=self.user)

        entry = TimeEntry.objects.create(
            workspace=self.workspace,
            user=self.user,
            start_time=timezone.now() - timedelta(minutes=10),
        )

        response = self.client.get("/api/time-entries/running/")

        self.assertEqual(response.status_code, 200)

        self.assertEqual(response.data["id"], entry.id)

    def test_stop_action_ends_timer(self):
        self.client.force_authenticate(user=self.user)

        start_time = timezone.now() - timedelta(minutes=10)

        entry = TimeEntry.objects.create(
            workspace=self.workspace,
            user=self.user,
            start_time=start_time,
        )

        end_time = start_time + timedelta(minutes=5)

        response = self.client.post(
            f"/api/time-entries/{entry.id}/stop/",
            {
                "end_time": end_time.isoformat(),
            },
        )

        self.assertEqual(response.status_code, 200)

        entry.refresh_from_db()

        self.assertIsNotNone(entry.end_time)
        self.assertEqual(entry.end_time, end_time)
        self.assertEqual(entry.duration, timedelta(minutes=5))

    def test_manual_entry_rejects_invalid_time_range(self):
        self.client.force_authenticate(user=self.user)

        start_time = timezone.now()
        end_time = start_time - timedelta(minutes=1)

        response = self.client.post(
            "/api/time-entries/",
            {
                "workspace": self.workspace.id,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
            },
        )

        self.assertEqual(response.status_code, 400)

        self.assertEqual(
            response.data["end_time"],
            ["End time must be greater than start time."],
        )

    def test_manual_entry_can_attach_tags(self):
        self.client.force_authenticate(user=self.user)

        tag = Tag.objects.create(
            workspace=self.workspace,
            name="Backend",
            color="#2563eb",
        )

        start_time = timezone.now() - timedelta(hours=1)
        end_time = start_time + timedelta(minutes=30)

        response = self.client.post(
            "/api/time-entries/",
            {
                "workspace": self.workspace.id,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "tags": [tag.id],
            },
        )

        self.assertEqual(response.status_code, 201)

        entry = TimeEntry.objects.get(
            workspace=self.workspace,
            user=self.user,
            start_time=start_time,
        )

        self.assertTrue(
            entry.tags.filter(pk=tag.pk).exists()
        )