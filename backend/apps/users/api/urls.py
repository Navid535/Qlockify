from django.contrib.auth.views import PasswordChangeView
from django.urls import path

from apps.users.api.views import *

urlpatterns = [
    path('register/', RegisterAPIView.as_view(), name="register"),
    path('login/', LoginAPIView.as_view(), name="login"),
    path('logout/', LogoutAPIView.as_view(), name="logout"),
    path('token/refresh/', RefreshAPIView.as_view(), name='refresh'),
    path('me/', MeAPIView.as_view(), name="me"),
    path('profile/picture/', ProfilePictureAPIView.as_view(), name="profile-picture"),
    path('search/', UserSearchAPIView.as_view(), name="search"),
    path('password/change/',PasswordChangeAPIView.as_view(), name='password-change'),
]

# "access":
# "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzg4NzY4NjIzLCJpYXQiOjE3ODg3NjgzMjMsImp0aSI6IjExNDAwNDY0YTc3ODQzY2U4Y2VjYTBlZDlmZmVlZWM3IiwidXNlcl9pZCI6IjIifQ.lrZgQPIT-uoCQFjQiXF3h1s93bM9VxnjJSjSEWAsR7s",
# "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4ODg1NDcyMywiaWF0IjoxNzg4NzY4MzIzLCJqdGkiOiJlMTQ4YWNmMTc2ODY0ZWNiYWNkZDNhZjI0Zjc3YjUyZCIsInVzZXJfaWQiOiIyIn0.1Ym8Jexb3yzqlWfdwtIvDHUchfDIRvsfNTquVRVMSFc"
