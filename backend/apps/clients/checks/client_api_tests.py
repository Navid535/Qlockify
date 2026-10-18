from django.test import override_settings
from rest_framework.test import APITestCase

from apps.clients.models import Client
from apps.notifications.models import Notification
from apps.users.models import User
from apps.workspaces.models import Workspace, WorkspaceMembership


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ClientApiChecks(APITestCase):
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

        self.visible_client = Client.objects.create(
            workspace=self.workspace,
            name="Visible Client",
        )
        self.hidden_client = Client.objects.create(
            workspace=self.hidden_workspace,
            name="Hidden Client",
        )


    def test_owner_can_create_client(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/clients/",
            {
                "workspace": self.workspace.id,
                "name": "New Client",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Client.objects.filter(
                workspace=self.workspace,
                name="New Client",
            ).exists()
        )

    def test_member_only_sees_visible_clients(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.get("/api/clients/")

        self.assertEqual(response.status_code, 200)

        names = [client["name"] for client in response.data["results"]]

        self.assertIn("Visible Client", names)
        self.assertNotIn("Hidden Client", names)

    def test_duplicate_name_is_rejected_in_workspace(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/clients/",
            {
                "workspace": self.workspace.id,
                "name": "Visible Client",
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_member_cannot_create_client_in_hidden_workspace(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            "/api/clients/",
            {
                "workspace": self.hidden_workspace.id,
                "name": "Unauthorized Client",
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_client_creation_creates_notification(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/clients/",
            {
                "workspace": self.workspace.id,
                "name": "Notification Client",
            },
        )

        self.assertEqual(response.status_code, 201)

        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                event_type="client_created",
            ).exists()
        )