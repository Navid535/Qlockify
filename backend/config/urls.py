from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('apps.workspaces.urls')),
    path('auth/', include('apps.users.urls')),
    path('api/users/', include('apps.users.api.urls')),
    path('api/notifications/', include('apps.notifications.api.urls')),
    path('api/workspaces/', include('apps.workspaces.api.urls')),
    path("api/workspace-memberships/", include("apps.workspaces.api.membership_urls")),
    path("api/memberships/", include("apps.workspaces.api.membership_urls")),
    path("api/clients/", include("apps.clients.api.urls")),
    path("api/tags/", include("apps.tags.api.urls")),
    path("api/projects/", include("apps.projects.api.urls")),
    path("api/time-entries/", include("apps.time_entries.api.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
