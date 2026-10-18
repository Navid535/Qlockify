from apps.notifications.models import Notification


def create_notification(user, title, body="", event_type="system", meta=None):
    return Notification.objects.create(
        user=user,
        title=title,
        body=body,
        event_type=event_type,
        meta=meta or {},
    )
