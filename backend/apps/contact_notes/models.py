from django.db import models

from core.models import TimestampedModel


class ContactNote(TimestampedModel):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    message = models.TextField()
    is_reviewed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} | {self.email}"
