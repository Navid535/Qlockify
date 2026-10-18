from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import UniqueConstraint, Q

from apps.workspaces.models import Workspace
from apps.clients.models import Client
from core.models import TimestampedModel
from core.models.base import SoftDeleteQuerySet, SoftDeleteManager


class ProjectQuerySet(SoftDeleteQuerySet):
    def visible_to(self, user):
        if not user:
            return self.none()
        return self.filter(
            workspace__memberships__user=user,
            workspace__memberships__is_active=True,
            workspace__memberships__is_deleted=False,
            is_deleted=False
        ).distinct()

    def not_archived(self):
        return self.filter(is_archived=False)



class Project(TimestampedModel):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="projects")
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    color = models.CharField(max_length=20, default="#2563eb")
    description = models.TextField(null=True, blank=True)
    thumbnail = models.ImageField(upload_to="projects/", null=True, blank=True)
    is_archived = models.BooleanField(default=False)

    objects = SoftDeleteManager.from_queryset(ProjectQuerySet)()

    class Meta:
        ordering = ["name"]
        constraints = [
            UniqueConstraint(
                fields=["workspace", "name"],
                condition=Q(is_deleted=False),
                name="unique_project_name_per_workspace",
            )
        ]

    def clean(self):
        if self.client and self.workspace != self.client.workspace:
            raise ValidationError("Client must belong to the same workspace.")

    def __str__(self):
        return self.name