from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser, PermissionsMixin
from django.db import models

class UserManager(BaseUserManager):

    def _create_user(self, mobile, password, **extra_fields):
        if not mobile:
            raise ValueError("The given mobile must be set")

        extra_fields.pop('mobile', None)

        user = self.model(mobile=mobile, **extra_fields)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, mobile, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(mobile, password, **extra_fields)

    def create_superuser(self, mobile, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(mobile, password, **extra_fields)


class User(AbstractUser, PermissionsMixin):
    mobile = models.CharField(max_length=20, unique=True)
    email = models.EmailField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    profile_picture = models.ImageField(null=True, blank=True, upload_to='profiles/')
    USERNAME_FIELD = "mobile"
    REQUIRED_FIELDS = []
    username = None
    first_name = models.CharField("first name", max_length=30, blank=True)
    last_name = models.CharField("last name", max_length=30, blank=True)
    is_active = models.BooleanField("active", default=True)
    is_staff = models.BooleanField("staff status", default=False)
    date_joined = models.DateTimeField("date joined", auto_now_add=True)

    class Meta:
        ordering = ["first_name", "last_name", "mobile"]

    objects = UserManager()

    @property
    def full_name(self):
        if not self.first_name and not self.last_name:
            return self.mobile
        return f"{self.first_name.strip()} {self.last_name.strip()}"


    def __str__(self):
        return self.full_name

