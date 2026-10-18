from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User


class AuthAPITests(APITestCase):
    def setUp(self):
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.me_url = reverse('me')
        self.search_url = reverse('search')

        self.existing_user = User.objects.create_user(
            mobile='09120000001',
            password='OldPass123',
            first_name='Ali',
            last_name='Ahmadi',
        )

    def test_register_success(self):
        data = {
            'mobile': '09120000002',
            'password': 'StrongPass123',
            'first_name': 'Sara',
            'last_name': 'Karimi',
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_register_duplicate_mobile(self):
        data = {
            'mobile': self.existing_user.mobile,
            'password': 'StrongPass123',
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile', response.data)

    def test_login_success(self):
        data = {'mobile': self.existing_user.mobile, 'password': 'OldPass123'}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_me_requires_authentication(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_update(self):
        self.client.force_authenticate(user=self.existing_user)
        response = self.client.patch(self.me_url, {'first_name': 'Reza'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.existing_user.refresh_from_db()
        self.assertEqual(self.existing_user.first_name, 'Reza')

    def test_user_search_found(self):
        self.client.force_authenticate(user=self.existing_user)
        response = self.client.get(self.search_url, {'mobile': self.existing_user.mobile})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['mobile'], self.existing_user.mobile)

    def test_user_search_not_found(self):
        self.client.force_authenticate(user=self.existing_user)
        response = self.client.get(self.search_url, {'mobile': '09129999999'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)