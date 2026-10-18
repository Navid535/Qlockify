from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin, UserAdmin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.models import Group

from unfold.admin import ModelAdmin as UnfoldModelAdmin
from unfold.forms import UserChangeForm, UserCreationForm, AdminPasswordChangeForm

from apps.users.models import User


admin.site.unregister(Group)

@admin.register(Group)
class CustomGroupAdmin(BaseGroupAdmin, UnfoldModelAdmin):
    pass

@admin.register(User)
class CustomUserAdmin(BaseUserAdmin, UnfoldModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm


    list_display = ["mobile", "email", "first_name", "last_name", "is_staff", "is_active"]
    list_filter = ["is_staff", "is_active", "is_superuser"]
    search_fields = ["mobile", "email", "first_name", "last_name"]
    ordering = ["mobile"]
    readonly_fields = ["date_joined", "last_login"]

    fieldsets = (
        ("Personal info",
            {"fields": ("first_name", "last_name", "email", "birth_date", "description")}
        ),
        ("Permissions",
         {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        ("Personal info",
            {"fields": ("mobile", "password1", "password2")}
        ),
    )