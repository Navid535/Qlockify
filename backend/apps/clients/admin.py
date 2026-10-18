from django.contrib import admin

from apps.clients.models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ["workspace", "name"]
    search_fields = ["name"]
    list_filter = ["workspace"]
    ordering = ["created_at"]