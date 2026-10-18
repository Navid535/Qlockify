from datetime import timedelta

from celery import shared_task
from django.http.response import Http404
from django.utils import timezone

from apps.notifications.models import Notification
from apps.users.models import User
from apps.notifications.services import create_notification

@shared_task
def create_notification_task(user_id, title, body=""):
    user = User.objects.get(pk=user_id)
    notification = create_notification(user, title, body)
    return str(notification.id)

@shared_task
def cleanup_read_notifications(days=30):
    cutoff = timezone.now() - timedelta(days=days)
    notifications = Notification.objects.filter(updated_at__lt=cutoff, is_read=True)
    count = notifications.count()
    for notification in notifications:
        notification.delete()
    return count

