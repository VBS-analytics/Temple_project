"""API views for user authentication and profile management."""

from decimal import Decimal

from django.db.models import Max, Sum
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DonorProfile, FamilyMember, GothraOption, User, UserRole
from .serializers import (
    AdminDonorUserUpdateSerializer,
    DonorProfileSerializer,
    FamilyMemberSerializer,
    LoginSerializer,
    OtpRequestSerializer,
    OtpVerifySerializer,
    PasswordResetSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
    GothraOptionSerializer,
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
        members = FamilyMember.objects.filter(user=request.user)
        member_serializer = FamilyMemberSerializer(members, many=True)
        return Response(
            {
                "user": user_serializer.data,
                "profile": profile_serializer.data,
                "members": member_serializer.data,
            }
        )

    def put(self, request):
        profile, _ = DonorProfile.objects.get_or_create(user=request.user)
        serializer = ProfileUpdateSerializer(instance=profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class FamilyMemberView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        members = FamilyMember.objects.filter(user=request.user)
        serializer = FamilyMemberSerializer(members, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = FamilyMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.save(user=request.user)
        output = FamilyMemberSerializer(member)
        return Response(output.data, status=status.HTTP_201_CREATED)


class FamilyMemberDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self, request, pk: int) -> FamilyMember:
        try:
            return FamilyMember.objects.get(pk=pk, user=request.user)
        except FamilyMember.DoesNotExist as exc:  # pragma: no cover - user mis-id
            raise NotFound("Family member not found") from exc

    def put(self, request, pk: int):
        member = self.get_object(request, pk)
        serializer = FamilyMemberSerializer(instance=member, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk: int):
        member = self.get_object(request, pk)
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DonorListView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        donors = (
            User.objects.filter(role=UserRole.DONOR)
            .select_related('profile')
            .prefetch_related('family_members')
        )
        payload = []
        for donor in donors:
            profile, _ = DonorProfile.objects.get_or_create(user=donor)
            members = donor.family_members.all()
            payload.append(
                {
                    'user': UserSerializer(donor).data,
                    'profile': DonorProfileSerializer(profile).data,
                    'members': FamilyMemberSerializer(members, many=True).data,
                }
            )
        return Response(payload)


class DonorDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self, pk: int) -> User:
        try:
            return User.objects.select_related("profile").get(pk=pk, role=UserRole.DONOR)
        except User.DoesNotExist as exc:  # pragma: no cover - user mis-id
            raise NotFound("Donor not found") from exc

    def put(self, request, pk: int):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        donor = self.get_object(pk)
        profile, _ = DonorProfile.objects.get_or_create(user=donor)

        user_data = request.data.get("user") or {}
        profile_data = request.data.get("profile") or {}

        if not user_data and not profile_data:
            return Response({"detail": "No fields provided"}, status=status.HTTP_400_BAD_REQUEST)

        if user_data:
            user_serializer = AdminDonorUserUpdateSerializer(instance=donor, data=user_data, partial=True)
            user_serializer.is_valid(raise_exception=True)
            user_serializer.save()

        if profile_data:
            profile_serializer = ProfileUpdateSerializer(instance=profile, data=profile_data, partial=True)
            profile_serializer.is_valid(raise_exception=True)
            profile_serializer.save()

        donor.refresh_from_db()
        profile.refresh_from_db()

        return Response(
            {
                "user": UserSerializer(donor).data,
                "profile": DonorProfileSerializer(profile).data,
            },
            status=status.HTTP_200_OK,
        )

    patch = put


class DashboardMetricsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        donor_count = User.objects.filter(role=UserRole.DONOR).count()
        family_member_count = FamilyMember.objects.count()
        donation_metrics = DonorProfile.objects.aggregate(total=Sum("monthly_donation_amount"))
        donation_total = donation_metrics.get("total") or Decimal("0.00")

        return Response(
            {
                "donor_count": donor_count,
                "family_member_count": family_member_count,
                "donation_amount": str(donation_total),
            },
            status=status.HTTP_200_OK,
        )


class GothraOptionPermission(permissions.BasePermission):
    """Allow anyone to read gothra options but restrict writes to admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.ADMIN)


class GothraOptionViewSet(viewsets.ModelViewSet):
    queryset = GothraOption.objects.order_by("display_order", "name")
    serializer_class = GothraOptionSerializer
    permission_classes = (GothraOptionPermission,)

    def perform_create(self, serializer):
        max_order = GothraOption.objects.aggregate(Max("display_order")).get("display_order__max") or 0
        serializer.save(display_order=max_order + 1)
