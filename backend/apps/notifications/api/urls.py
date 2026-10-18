from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.notifications.api.views import *

router = DefaultRouter()
router.register("", NotificationViewSet, basename="notifications")

urlpatterns = [
    path("list/", NotificationListAPIView.as_view(), name="list"),
    path("seen/", NotificationSeenAPIView.as_view(), name="seen"),
    path("seen/all/", NotificationSeenAllAPIView.as_view(), name="seen-all"),
    path('stream-token/', NotificationStreamTokenAPIView.as_view(), name='stream-token'),
    path('stream/', notification_stream, name='stream'),
    *router.urls,
]