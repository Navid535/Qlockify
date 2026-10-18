from django.contrib import admin, messages
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from core.admins.filters import SoftDeleteListFilter


class SoftDeleteAdmin(UnfoldModelAdmin):
    actions = ("soft_delete_selected", "restore_selected", "hard_delete_selected")

    def get_queryset(self, request):
        if hasattr(self.model, "all_objects"):
            return self.model.all_objects.all()
        return super().get_queryset(request)

    def get_list_filter(self, request):
        filters = list(super().get_list_filter(request))
        if SoftDeleteListFilter not in filters:
            filters.append(SoftDeleteListFilter)
        return filters

    def delete_model(self, request, obj):
        obj.delete()

    def delete_queryset(self, request, queryset):
        queryset.delete()

    @admin.action(description="Soft delete selected records")
    def soft_delete_selected(self, request, queryset):
        count = queryset.filter(is_deleted=False).count()
        queryset.filter(is_deleted=False).delete()
        self.message_user(request, f"{count} record(s) soft deleted.", messages.SUCCESS)

    @admin.action(description="Restore selected records")
    def restore_selected(self, request, queryset):
        restored = 0
        for obj in queryset.filter(is_deleted=True):
            obj.restore()
            restored += 1
        self.message_user(request, f"{restored} record(s) restored.", messages.SUCCESS)

    @admin.action(description="Hard delete selected records")
    def hard_delete_selected(self, request, queryset):
        count = queryset.count()
        queryset.hard_delete()
        self.message_user(request, f"{count} record(s) permanently deleted.", messages.WARNING)
