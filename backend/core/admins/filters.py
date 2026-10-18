from django.contrib import admin


class SoftDeleteListFilter(admin.SimpleListFilter):
    title = "Soft delete status"
    parameter_name = "is_deleted"

    def lookups(self, request, model_admin):
        return (
            ("active", "Active"),
            ("deleted", "Deleted"),
        )

    def queryset(self, request, queryset):
        if self.value() == "active":
            return queryset.filter(is_deleted=False)
        if self.value() == "deleted":
            return queryset.filter(is_deleted=True)
        return queryset
