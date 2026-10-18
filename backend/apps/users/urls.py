from django.contrib.auth.views import LoginView, LogoutView
from django.urls import path

from apps.users.forms import LoginForm
from apps.users.views import RegisterView, ProfileUpdateView

app_name = 'users'

urlpatterns = [
    path('login/', LoginView.as_view(form_class=LoginForm), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('register/', RegisterView.as_view(), name='register'),
    path('profile/', ProfileUpdateView.as_view(), name='profile'),
]