from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import UniqueConstraint, Q
from django.utils import timezone

from apps.projects.models import Project
from apps.tags.models import Tag
from apps.workspaces.models import Workspace
from django.conf import settings
from core.models import TimestampedModel
from core.models.base import SoftDeleteQuerySet, SoftDeleteManager


class TimeEntryQuerySet(SoftDeleteQuerySet):
    def visible_to(self, user):
        return self.filter(user=user)

    def running(self):
        return self.filter(end_time__isnull=True)


class TimeEntry(TimestampedModel):
    workspace = models.ForeignKey(Workspace, related_name="time_entries", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="time_entries", on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True)
    tags = models.ManyToManyField(Tag, related_name="time_entries", blank=True)
    description = models.TextField(blank=True, null=True)
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)
    is_billable = models.BooleanField(default=False)

    objects = SoftDeleteManager.from_queryset(TimeEntryQuerySet)()

    class Meta:
        verbose_name_plural = "time entries"
        ordering = ["-start_time", "-created_at"]
        constraints = [
            UniqueConstraint(
                fields=["workspace", "user"],
                condition=Q(is_deleted=False, end_time__isnull=True),
                name="unique_running_entry_per_user_workspace"
            )
        ]

    @property
    def duration_seconds(self):
        if not self.duration:
            return None
        else:
            return self.duration.total_seconds()

    def clean(self):
        if self.project:
            if self.project.workspace != self.workspace:
                raise ValidationError("Project must belong to the same workspace.")

        if self.start_time and self.end_time:
            if self.start_time > self.end_time:
                raise ValidationError("End time must be after start time.")

    def save(self, *args, **kwargs):
        if self.start_time and self.end_time:
            self.duration = max(self.end_time - self.start_time, timedelta(0))
        if not self.end_time:
            self.duration = None

        super().save(*args, **kwargs)

    def stop(self, ended_at=None):
        self.end_time = ended_at or timezone.now()
        self.full_clean()
        self.save(update_fields=["end_time", "duration", "updated_at"])
        return self

    def __str__(self):
        return f"{self.user} - {self.start_time:%Y-%m-%d %H:%M}"
