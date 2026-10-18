from django.contrib import admin

from unfold.admin import TabularInline

from apps.workspaces.models import Workspace, WorkspaceMembership
from core.admins.base import SoftDeleteAdmin

class WorkspaceMembershipInline(TabularInline):
    model = WorkspaceMembership
    extra = 0

@admin.register(Workspace)
class WorkspaceAdmin(SoftDeleteAdmin):
    list_display = ["name", "owner", "created_at"]
    search_fields = ["name", "owner__mobile"]
    list_filter = ["created_at"]
    ordering = ["name"]
    inlines = [WorkspaceMembershipInline]


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(SoftDeleteAdmin):
    list_display = ["user", "workspace", "role", "is_active", "created_at"]
    search_fields = ["workspace__name", "user__mobile"]
    list_filter = ["role", "is_active", "created_at"]