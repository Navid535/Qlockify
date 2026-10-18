from rest_framework import status
from rest_framework.generics import CreateAPIView, RetrieveUpdateAPIView
from rest_framework.parsers import FileUploadParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.api.serializers import RegisterSerializer, UserSerializer, LoginSerializer, PasswordChangeSerializer
from apps.users.api.throttles import AuthRateThrottle
from apps.users.models import User


class RegisterAPIView(CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = (AllowAny,)
    throttle_classes = (AuthRateThrottle, )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        data = UserSerializer(user, context=self.get_serializer_context()).data
        data['access'] = access_token
        data['refresh'] = refresh_token

        headers = self.get_success_headers(serializer.data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

class LoginAPIView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (AuthRateThrottle, )

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data.get('user')

        token = RefreshToken.for_user(user)
        refresh_token = str(token)
        access_token = str(token.access_token)

        data = UserSerializer(user, context=serializer.context).data
        data['access'] = access_token
        data['refresh'] = refresh_token

        return Response(data, status=status.HTTP_200_OK)


class RefreshAPIView(TokenRefreshView):
    permission_classes = (AllowAny,)


class LogoutAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh_token') or request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response(status=status.HTTP_204_NO_CONTENT)

class MeAPIView(RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        return self.request.user

class ProfilePictureAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser,)

    def post(self, request, *args, **kwargs):
        profile_picture = request.data.get('profile_picture')
        if not profile_picture:
            return Response(
                data={"profile_picture": "This file is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        user = request.user
        user.profile_picture = profile_picture
        user.save()
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


    def delete(self, request, *args, **kwargs):
        user = request.user
        if user.profile_picture:
            user.profile_picture.delete(save=False)
            user.profile_picture = None
            user.save()
            serializer = UserSerializer(user, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(status=status.HTTP_400_BAD_REQUEST)

class PasswordChangeAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def patch(self, request, *args, **kwargs):
        user = request.user
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user.set_password(serializer.validated_data['new_password'])
        user.save()

        return Response({"detail": "Password changed."}, status=status.HTTP_200_OK)

class UserSearchAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, format=None):
        mobile = request.GET.get('mobile')
        if not mobile:
            return Response({"mobile": "This query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(mobile=mobile).first()
        if not user:
            return Response("User not found.", status=status.HTTP_404_NOT_FOUND)
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)