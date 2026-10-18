from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.projects.models import Project
from apps.time_entries.models import TimeEntry
from apps.users.models import User
from apps.workspaces.models import Workspace


class TimesheetFilterChecks(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            mobile="09120000001",
            password="password",
        )

        self.workspace = Workspace.objects.create(
            name="Main Workspace",
            owner=self.user,
        )

        self.project = Project.objects.create(
            workspace=self.workspace,
            name="Website",
        )

        self.other_project = Project.objects.create(
            workspace=self.workspace,
            name="Mobile App",
        )

        self.base_time = timezone.make_aware(datetime(2026, 1, 15, 12, 0, 0))

        self.client.force_authenticate(user=self.user)

    def create_entry(self, project, description="", start_time=None, end_time=None):
        if start_time is None:
            start_time = self.base_time
        return TimeEntry.objects.create(
            workspace=self.workspace,
            user=self.user,
            project=project,
            description=description,
            start_time=start_time,
            end_time=end_time,
        )

    def test_project_filter_returns_project_entries(self):
        matching_entry = self.create_entry(
            self.project, description="Website work", end_time=self.base_time + timedelta(hours=1)
        )
        other_entry = self.create_entry(
            self.other_project, description="Mobile work", end_time=self.base_time + timedelta(hours=1)
        )

        response = self.client.get("/api/time-entries/", {"project": self.project.id})
        self.assertEqual(response.status_code, 200)

        entries = response.data["groups"][0]["days"][0]["entries"]
        entry_ids = [entry["id"] for entry in entries]

        self.assertIn(matching_entry.id, entry_ids)
        self.assertNotIn(other_entry.id, entry_ids)

    def test_search_filter_matches_description(self):
        matching_entry = self.create_entry(
            self.project, description="Implement authentication API", end_time=self.base_time + timedelta(hours=1)
        )
        other_entry = self.create_entry(
            self.project, description="Fix frontend styling", end_time=self.base_time + timedelta(hours=1)
        )

        response = self.client.get("/api/time-entries/", {"search": "authentication"})
        self.assertEqual(response.status_code, 200)

        entries = response.data["groups"][0]["days"][0]["entries"]
        entry_ids = [entry["id"] for entry in entries]

        self.assertIn(matching_entry.id, entry_ids)
        self.assertNotIn(other_entry.id, entry_ids)

    def test_status_ended_returns_only_ended_entries(self):
        ended_entry = self.create_entry(
            self.project, description="Finished task", end_time=self.base_time + timedelta(hours=1)
        )
        running_entry = self.create_entry(
            self.project, description="Current task", end_time=None
        )

        response = self.client.get("/api/time-entries/", {"status": "ended"})
        self.assertEqual(response.status_code, 200)

        entries = [
            entry
            for group in response.data["groups"]
            for day in group["days"]
            for entry in day["entries"]
        ]
        entry_ids = [entry["id"] for entry in entries]

        self.assertIn(ended_entry.id, entry_ids)
        self.assertNotIn(running_entry.id, entry_ids)

    def test_started_after_and_before_filters(self):
        old_entry = self.create_entry(
            self.project,
            start_time=self.base_time - timedelta(days=2),
            end_time=self.base_time - timedelta(days=2) + timedelta(hours=1),
        )
        new_entry = self.create_entry(
            self.project,
            start_time=self.base_time,
            end_time=self.base_time + timedelta(hours=1),
        )

        after_response = self.client.get(
            "/api/time-entries/", {"started_after": self.base_time.isoformat()}
        )
        after_entries = [
            entry
            for group in after_response.data["groups"]
            for day in group["days"]
            for entry in day["entries"]
        ]
        after_ids = [entry["id"] for entry in after_entries]
        self.assertIn(new_entry.id, after_ids)
        self.assertNotIn(old_entry.id, after_ids)

        before_response = self.client.get(
            "/api/time-entries/",
            {"started_before": (self.base_time - timedelta(days=1)).isoformat()},
        )
        before_entries = [
            entry
            for group in before_response.data["groups"]
            for day in group["days"]
            for entry in day["entries"]
        ]
        before_ids = [entry["id"] for entry in before_entries]
        self.assertIn(old_entry.id, before_ids)
        self.assertNotIn(new_entry.id, before_ids)

    def test_ordering_preserves_grouped_structure(self):
        self.create_entry(
            self.project,
            description="Older entry",
            start_time=self.base_time - timedelta(days=2),
            end_time=self.base_time - timedelta(days=2) + timedelta(hours=1),
        )
        self.create_entry(
            self.project,
            description="Newer entry",
            start_time=self.base_time - timedelta(days=1),
            end_time=self.base_time - timedelta(days=1) + timedelta(hours=1),
        )

        response = self.client.get("/api/time-entries/", {"ordering": "-start_time"})
        self.assertEqual(response.status_code, 200)

        self.assertIn("groups", response.data)
        self.assertNotIn("results", response.data)

        groups = response.data["groups"]
        self.assertGreaterEqual(len(groups), 2)
        self.assertGreater(groups[0]["key"], groups[1]["key"])