from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.workspaces.models import Workspace, WorkspaceMembership


@receiver(post_save, sender=Workspace)
def ensure_workspace_membership(sender, instance, created, **kwargs):
    if created:
        WorkspaceMembership.objects.get_or_create(
            workspace=instance,
            user=instance.owner,
            defaults={
                "role": WorkspaceMembership.Role.OWNER,
                "is_active": True,
            },
        )