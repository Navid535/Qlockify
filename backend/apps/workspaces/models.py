from django.contrib.auth import user_logged_in
from django.contrib.auth.base_user import AbstractBaseUser
from django.db import models
from django.db.models import Q, UniqueConstraint

from apps.users.models import User
from core.models import TimestampedModel
from core.models.base import SoftDeleteQuerySet, SoftDeleteManager


class WorkspaceQuerySet(SoftDeleteQuerySet):
    def visible_to(self, user):
        if not user or not user.is_authenticated:
            return self.none()
        return self.filter(
            memberships__user=user,
            memberships__is_deleted=False,
            memberships__is_active=True
        ).distinct()





class Workspace(TimestampedModel):
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    thumbnail = models.ImageField(
        upload_to="workspaces/",
        null=True,
        blank=True,
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="owned_workspaces",
    )

    objects = SoftDeleteManager.from_queryset(WorkspaceQuerySet)()

    class Meta:
        ordering = ["name", "created_at"]
        constraints = [
            UniqueConstraint(
                fields=["owner", "name"],
                condition=Q(is_deleted=False),
                name="unique_workspace_name_per_owner",
            )
        ]

    def __str__(self):
        return self.name


class WorkspaceMembershipQuerySet(SoftDeleteQuerySet):
    def enabled(self):
        return self.filter(is_active=True, is_deleted=False)

    def for_user(self, user):
        if not user or not user.is_authenticated:
            return self.none()
        return self.enabled().filter(user=user)

class WorkspaceMembership(TimestampedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"


    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(choices=Role.choices, default=Role.MEMBER, max_length=10)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    objects = SoftDeleteManager.from_queryset(WorkspaceMembershipQuerySet)()

    class Meta:
        ordering = ["workspace__name", "user__mobile"]
        constraints = [
            UniqueConstraint(
                fields=["workspace", "user"],
                condition=Q(is_deleted=False),
                name="unique_workspace_membership",
            )
        ]

    def __str__(self):
        return f"{self.user} - {self.workspace}"