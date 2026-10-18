from django.db import models
from django.db.models import UniqueConstraint, Q

from apps.workspaces.models import Workspace
from core.models import TimestampedModel
from core.models.base import SoftDeleteQuerySet, SoftDeleteManager


class TagQuerySet(SoftDeleteQuerySet):
    def visible_to(self, user):
        if not user:
            return self.none()

        return self.filter(
            workspace__memberships__user=user,
            workspace__memberships__is_active=True,
            workspace__memberships__is_deleted=False,
            is_deleted=False
        ).distinct()


class Tag(TimestampedModel):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="tags")
    name = models.CharField(max_length=120)
    color = models.CharField(max_length=20, default="#64748b")

    objects = SoftDeleteManager.from_queryset(TagQuerySet)()

    class Meta:
        ordering = ["name"]
        constraints = [
            UniqueConstraint(
                fields=["workspace", "name"],
                condition=Q(is_deleted=False),
                name="unique_tag_name_per_workspace"),
        ]

    def __str__(self):
        return self.name