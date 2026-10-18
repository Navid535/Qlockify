from django import forms

from apps.contact_notes.models import ContactNote


class ContactNoteForm(forms.ModelForm):
    class Meta:
        model = ContactNote
        fields = ["name", "email", "message"]
        widgets = {
            # "name": forms.Textarea(attrs={"class": "form-control"}),
            # "email": forms.EmailInput(attrs={"class": "form-control"}),
            "message": forms.Textarea(attrs={"class": "form-control", "rows": 5}),
        }

    def clean_message(self):
        message = self.cleaned_data["message"]
        if len(message.strip()) < 10:
            raise forms.ValidationError('Message must contain at least 10 characters.')
        return message