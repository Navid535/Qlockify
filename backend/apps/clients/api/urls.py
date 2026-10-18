from rest_framework.routers import DefaultRouter

from apps.clients.api.views import ClientViewSet

router = DefaultRouter()
router.register(r"", ClientViewSet, basename="client")
urlpatterns = router.urls