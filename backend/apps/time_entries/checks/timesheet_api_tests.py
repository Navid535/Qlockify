from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.time_entries.models import TimeEntry
from apps.users.models import User
from apps.workspaces.models import Workspace, WorkspaceMembership


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class TimesheetApiChecks(APITestCase):
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

        self.client.force_authenticate(user=self.user)

    def test_list_returns_groups(self):
        start_time = timezone.now() - timedelta(hours=2)
        end_time = start_time + timedelta(hours=1)

        TimeEntry.objects.create(
            workspace=self.workspace,
            user=self.user,
            start_time=start_time,
            end_time=end_time,
        )

        response = self.client.get("/api/time-entries/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("groups", response.data)
        self.assertNotIn("results", response.data)
        self.assertEqual(len(response.data["groups"]), 1)

    def test_grouped_endpoint_returns_groups(self):
        start_time = timezone.now() - timedelta(hours=2)
        end_time = start_time + timedelta(minutes=30)

        TimeEntry.objects.create(
            workspace=self.workspace,
            user=self.user,
            start_time=start_time,
            end_time=end_time,
        )

        response = self.client.get("/api/time-entries/grouped/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("groups", response.data)
        self.assertEqual(len(response.data["groups"]), 1)

        group = response.data["groups"][0]

        self.assertIn("key", group)
        self.assertIn("week_start", group)
        self.assertIn("week_end", group)
        self.assertIn("total_ms", group)
        self.assertIn("days", group)

    def test_total_ms_uses_duration(self):
        start_time = timezone.now() - timedelta(hours=2)
        end_time = start_time + timedelta(hours=1, minutes=30)

        TimeEntry.objects.create(
            workspace=self.workspace,
            user=self.user,
            start_time=start_time,
            end_time=end_time,
        )

        response = self.client.get("/api/time-entries/grouped/")

        self.assertEqual(response.status_code, 200)

        group = response.data["groups"][0]

        self.assertEqual(
            group["total_ms"],
            90 * 60 * 1000,
        )

        day = group["days"][0]

        self.assertEqual(
            day["total_ms"],
            90 * 60 * 1000,
        )

    def test_empty_timesheet_returns_empty_groups(self):
        response = self.client.get("/api/time-entries/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["groups"], [])
        self.assertEqual(response.data["current_page_items_count"], 0)
        self.assertEqual(response.data["total_items"], 0)

    def test_group_key_is_entry_date(self):
        start_time = timezone.now().replace(
            year=2026,
            month=5,
            day=30,
            hour=10,
            minute=15,
            second=0,
            microsecond=0,
        )
        end_time = start_time + timedelta(hours=1)

        TimeEntry.objects.create(
            workspace=self.workspace,
            user=self.user,
            start_time=start_time,
            end_time=end_time,
        )

        response = self.client.get("/api/time-entries/grouped/")

        self.assertEqual(response.status_code, 200)

        group = response.data["groups"][0]

        self.assertEqual(group["key"], "2026-05-30")
        self.assertEqual(group["week_start"], "2026-05-30")
        self.assertEqual(group["week_end"], "2026-05-30")

        day = group["days"][0]

        self.assertEqual(day["key"], "2026-05-30")
        self.assertEqual(day["date"], "2026-05-30")