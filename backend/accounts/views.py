"""API views for user authentication and profile management."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DonorProfile
from .serializers import (
    DonorProfileSerializer,
    LoginSerializer,
    OtpRequestSerializer,
    OtpVerifySerializer,
    PasswordResetSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.save()
        return Response(payload, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.save()
        return Response(payload, status=status.HTTP_200_OK)


class RequestOtpView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = OtpRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.save()
        # For now we surface the code so QA/dev can read it; in prod integrate SMS.
        return Response(
            {
                "phone_number": token.phone_number,
                "purpose": token.purpose,
                "code": token.code,
                "expires_at": token.expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyOtpView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = OtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.save()
        return Response(
            {
                "verified": True,
                "phone_number": token.phone_number,
                "purpose": token.purpose,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated"}, status=status.HTTP_200_OK)


class ProfileView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user_serializer = UserSerializer(request.user)
        profile, _ = DonorProfile.objects.get_or_create(user=request.user)
        profile_serializer = DonorProfileSerializer(profile)
        return Response({"user": user_serializer.data, "profile": profile_serializer.data})

    def put(self, request):
        profile, _ = DonorProfile.objects.get_or_create(user=request.user)
        serializer = ProfileUpdateSerializer(instance=profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
