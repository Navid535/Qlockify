from rest_framework.routers import DefaultRouter

from apps.workspaces.api.views import WorkspaceViewSet, WorkspaceMembershipViewSet

router = DefaultRouter()
router.register(r'', WorkspaceViewSet, basename='workspace')
urlpatterns = router.urls