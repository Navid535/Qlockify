from rest_framework.routers import DefaultRouter

from apps.workspaces.api.views import WorkspaceMembershipViewSet

router = DefaultRouter()

router.register(r'', WorkspaceMembershipViewSet, basename='workspace-membership')

urlpatterns = router.urls