from django.test import override_settings
from rest_framework.test import APITestCase

from apps.clients.models import Client
from apps.notifications.models import Notification
from apps.projects.models import Project
from apps.users.models import User
from apps.workspaces.models import Workspace, WorkspaceMembership


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ProjectApiChecks(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            mobile="09120000001",
            password="password",
        )
        self.member = User.objects.create_user(
            mobile="09120000002",
            password="password",
        )
        self.other_user = User.objects.create_user(
            mobile="09120000003",
            password="password",
        )

        self.workspace = Workspace.objects.create(
            name="Main Workspace",
            owner=self.owner,
        )
        self.hidden_workspace = Workspace.objects.create(
            name="Hidden Workspace",
            owner=self.other_user,
        )

        WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.main_client = Client.objects.create(
            workspace=self.workspace,
            name="Main Client",
        )
        self.hidden_client = Client.objects.create(
            workspace=self.hidden_workspace,
            name="Hidden Client",
        )

        self.project = Project.objects.create(
            workspace=self.workspace,
            client=self.main_client,
            name="Main Project",
        )
        self.hidden_project = Project.objects.create(
            workspace=self.hidden_workspace,
            client=self.hidden_client,
            name="Hidden Project",
        )

    def test_owner_can_create_project(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/projects/",
            {
                "workspace": self.workspace.id,
                "client": self.main_client.id,
                "name": "New Project",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Project.objects.filter(
                workspace=self.workspace,
                name="New Project",
            ).exists()
        )

    def test_member_only_sees_visible_projects(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.get("/api/projects/")

        self.assertEqual(response.status_code, 200)

        names = [project["name"] for project in response.data["results"]]

        self.assertIn("Main Project", names)
        self.assertNotIn("Hidden Project", names)

    def test_client_must_belong_to_project_workspace(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/projects/",
            {
                "workspace": self.workspace.id,
                "client": self.hidden_client.id,
                "name": "Invalid Project",
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_archive_action_archives_project(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            f"/api/projects/{self.project.id}/archive/",
        )

        self.assertEqual(response.status_code, 200)

        self.project.refresh_from_db()
        self.assertTrue(self.project.is_archived)

    def test_project_creation_creates_notification(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/projects/",
            {
                "workspace": self.workspace.id,
                "client": self.main_client.id,
                "name": "Notification Project",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                event_type="project_created",
            ).exists()
        )