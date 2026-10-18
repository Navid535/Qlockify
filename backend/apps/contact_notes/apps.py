from django.apps import AppConfig


class ContactNotesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.contact_notes"
    label = "contact_notes"
    verbose_name = "Contact Notes"