from rest_framework.routers import DefaultRouter

from apps.time_entries.api.views import TimeEntryViewSet

router = DefaultRouter()
router.register(r'', TimeEntryViewSet, basename='time-entries')
urlpatterns = router.urls
