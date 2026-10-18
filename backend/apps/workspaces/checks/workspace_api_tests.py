from django.test import override_settings
from rest_framework.test import APITestCase

from apps.notifications.models import Notification
from apps.users.models import User
from apps.workspaces.models import Workspace, WorkspaceMembership


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class WorkspaceApiChecks(APITestCase):
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
            name="Owner Workspace",
            owner=self.owner,
        )

        WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
        )

    def test_owner_can_create_workspace(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/workspaces/",
            {
                "name": "New Workspace",
                "description": "Test workspace",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        workspace = Workspace.objects.get(name="New Workspace")

        self.assertEqual(workspace.owner, self.owner)

    def test_member_only_sees_joined_workspaces(self):
        other_workspace = Workspace.objects.create(
            name="Other Workspace",
            owner=self.other_user,
        )

        self.client.force_authenticate(user=self.member)

        response = self.client.get("/api/workspaces/")

        self.assertEqual(response.status_code, 200)

        workspace_ids = {
            workspace["id"]
            for workspace in response.data["results"]
        }

        self.assertIn(self.workspace.id, workspace_ids)
        self.assertNotIn(other_workspace.id, workspace_ids)

    def test_owner_can_add_member(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/workspace-memberships/",
            {
                "workspace": self.workspace.id,
                "user_id": self.other_user.id,
                "role": WorkspaceMembership.Role.MEMBER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        self.assertTrue(
            WorkspaceMembership.objects.filter(
                workspace=self.workspace,
                user=self.other_user,
                is_deleted=False,
            ).exists()
        )

    def test_member_cannot_add_member(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            "/api/workspace-memberships/",
            {
                "workspace": self.workspace.id,
                "user_id": self.other_user.id,
                "role": WorkspaceMembership.Role.MEMBER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_adding_member_creates_notification(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/workspace-memberships/",
            {
                "workspace": self.workspace.id,
                "user_id": self.other_user.id,
                "role": WorkspaceMembership.Role.MEMBER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        self.assertTrue(
            Notification.objects.filter(
                user=self.other_user,
                event_type="workspace_membership_added",
            ).exists()
        )


        """
            membership_api_permissions 64.28571428571429/90
        test_membership_list_requires_authentication PASS
            test score ratio: 6.428571428571429/90
            test time: 0.014
        test_membership_list_is_limited_to_visible_workspaces PASS
            test score ratio: 6.428571428571429/90
            test time: 0.030
        test_membership_list_can_be_filtered_by_workspace PASS
            test score ratio: 6.428571428571429/90
            test time: 0.029
        test_owner_can_add_workspace_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.020
        test_admin_can_add_workspace_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.022
        test_member_cannot_add_workspace_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.021
        test_membership_create_accepts_user_alias_payload PASS
            test score ratio: 6.428571428571429/90
            test time: 0.021
        test_duplicate_workspace_membership_is_rejected FAIL
            test score ratio: 6.428571428571429/90
            test time: 0.015
        test_admin_can_change_membership_role FAIL
            test score ratio: 6.428571428571429/90
            test time: 0.032
        test_member_cannot_change_membership_role FAIL
            test score ratio: 6.428571428571429/90
            test time: 0.032
        test_owner_can_remove_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.013
        test_member_cannot_remove_another_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.023
        test_membership_alias_route_supports_detail_update FAIL
            test score ratio: 6.428571428571429/90
            test time: 0.031
        test_membership_payload_returns_nested_user PASS
            test score ratio: 6.428571428571429/90
            test time: 0.021
    
membership_notifications 26.666666666666668/80
        test_add_member_creates_notification_for_target_user FAIL
            test score ratio: 26.666666666666668/80
            test time: 0.027
        test_role_change_creates_notification_for_target_user FAIL
            test score ratio: 26.666666666666668/80
            test time: 0.024
        test_remove_member_creates_notification_for_target_user PASS
            test score ratio: 26.666666666666668/80
            test time: 0.014
"""