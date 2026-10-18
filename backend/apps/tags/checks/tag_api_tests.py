from django.test import override_settings
from rest_framework.test import APITestCase

from apps.notifications.models import Notification
from apps.tags.models import Tag
from apps.users.models import User
from apps.workspaces.models import Workspace, WorkspaceMembership


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class TagApiChecks(APITestCase):
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

        self.visible_tag = Tag.objects.create(
            workspace=self.workspace,
            name="Visible Tag",
        )
        self.hidden_tag = Tag.objects.create(
            workspace=self.hidden_workspace,
            name="Hidden Tag",
        )

    def test_owner_can_create_tag(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/tags/",
            {
                "workspace": self.workspace.id,
                "name": "New Tag",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Tag.objects.filter(
                workspace=self.workspace,
                name="New Tag",
            ).exists()
        )

    def test_member_only_sees_visible_tags(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.get("/api/tags/")

        self.assertEqual(response.status_code, 200)

        names = [tag["name"] for tag in response.data["results"]]

        self.assertIn("Visible Tag", names)
        self.assertNotIn("Hidden Tag", names)

    def test_duplicate_name_is_rejected_in_workspace(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/tags/",
            {
                "workspace": self.workspace.id,
                "name": "Visible Tag",
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_member_cannot_create_tag_in_hidden_workspace(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            "/api/tags/",
            {
                "workspace": self.hidden_workspace.id,
                "name": "Unauthorized Tag",
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_tag_creation_creates_notification(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/tags/",
            {
                "workspace": self.workspace.id,
                "name": "Notification Tag",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                event_type="tag_created",
            ).exists()
        )