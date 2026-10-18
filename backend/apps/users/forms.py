from django import forms
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.conf import settings

User = get_user_model()

class RegisterForm(UserCreationForm):
    class Meta:
        model = User
        fields = ["mobile", "first_name", "last_name", "email"]


class ProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "birth_date", "description", "profile_picture"]
        widgets = {
            "birth_date": forms.DateInput(attrs={"class": "datepicker", "type": "date"}),
        }


class LoginForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["mobile"] = self.fields.pop("username")
        self.fields["mobile"].widget.attrs["autofocus"] = True

    def clean(self):
        mobile = self.cleaned_data.get("mobile")
        password = self.cleaned_data.get("password")
        if mobile and password:
            self.user_cache = authenticate(self.request, username=mobile, password=password)
            if self.user_cache is None:
                raise self.get_invalid_login_error()
            self.confirm_login_allowed(self.user_cache)
        return self.cleaned_data
