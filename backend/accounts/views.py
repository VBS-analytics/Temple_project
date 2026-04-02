"""API views for user authentication and profile management."""

import secrets
from decimal import Decimal
from io import BytesIO

from django.http import FileResponse
from django.db.models import Max, OuterRef, Subquery, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from openpyxl import Workbook
from payments.models import CombinePaymentMapping, PaymentRecord, PaymentStatus

from .models import (
    DonorFeedback,
    DonorProfile,
    FamilyMember,
    GothraOption,
    NakshatraOption,
    RasiOption,
    User,
    UserRole,
)
from .access import can_download_reports, REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE
from .serializers import (
    AdminDonorUserUpdateSerializer,
    BulkDonorUploadSerializer,
    DonorFeedbackSerializer,
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
    NakshatraOptionSerializer,
    RasiOptionSerializer,
)


class RegisterView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.save()
        return Response(payload, status=status.HTTP_201_CREATED)


PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"


def _generate_random_password(length: int = 10) -> str:
    return "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(length))


class BulkRegisterView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = BulkDonorUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        records = serializer.validated_data["records"]
        default_password = (serializer.validated_data.get("default_password") or "").strip()

        results = []
        created_count = 0
        updated_count = 0
        failed_count = 0

        for row_index, record in enumerate(records, start=1):
            payload = dict(record)
            source_row = payload.pop("source_row", None)
            existing_user = User.objects.filter(phone_number=payload.get("phone_number")).first()
            raw_password_value = payload.pop("password", "") or ""
            provided_password = raw_password_value.strip()
            payload.pop("confirm_password", None)
            password_to_use = None
            if existing_user:
                if provided_password:
                    password_to_use = provided_password
                    payload["password"] = password_to_use
                    payload["confirm_password"] = password_to_use
            else:
                password_to_use = provided_password or default_password or _generate_random_password()
                payload["password"] = password_to_use
                payload["confirm_password"] = password_to_use

            register_serializer = RegisterSerializer(
                data=payload, context={"skip_otp": True, "allow_update": True}
            )
            try:
                register_serializer.is_valid(raise_exception=True)
                is_update = bool(register_serializer.validated_data.get("existing_user"))
                register_serializer.save()
            except ValidationError as exc:
                failed_count += 1
                results.append(
                    {
                        "row": source_row or row_index,
                        "phone_number": record.get("phone_number", ""),
                        "status": "failed",
                        "errors": exc.detail,
                    }
                )
                continue

            if is_update:
                updated_count += 1
                result_status = "updated"
            else:
                created_count += 1
                result_status = "created"

            result_entry: dict[str, object] = {
                "row": source_row or row_index,
                "phone_number": record.get("phone_number", ""),
                "status": result_status,
            }
            if password_to_use:
                result_entry["password"] = password_to_use
            results.append(result_entry)

        return Response(
            {
                "created_count": created_count,
                "updated_count": updated_count,
                "failed_count": failed_count,
                "results": results,
            },
            status=status.HTTP_200_OK,
        )


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


class DonorFeedbackView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        if request.user.role != UserRole.DONOR:
            return Response({"detail": "Only donors can submit feedback."}, status=status.HTTP_403_FORBIDDEN)

        serializer = DonorFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feedback = serializer.save(
            donor_name=request.user.name,
            donor_phone_number=request.user.phone_number,
        )
        return Response(DonorFeedbackSerializer(feedback).data, status=status.HTTP_201_CREATED)


class DonorFeedbackExportView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @staticmethod
    def _format_datetime(value):
        if not value:
            return ""
        try:
            return timezone.localtime(value).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            return str(value)

    def get(self, request):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if not can_download_reports(request.user):
            return Response(
                {"detail": REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE},
                status=status.HTTP_403_FORBIDDEN,
            )

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Donor Feedback"
        sheet.append(
            [
                "ID",
                "Donor Name",
                "Donor Phone Number",
                "Feedback",
                "Created At",
            ]
        )

        feedback_rows = DonorFeedback.objects.all().order_by("-created_at", "-id")
        for feedback in feedback_rows:
            sheet.append(
                [
                    feedback.id,
                    feedback.donor_name,
                    feedback.donor_phone_number,
                    feedback.feedback,
                    self._format_datetime(feedback.created_at),
                ]
            )

        buffer = BytesIO()
        workbook.save(buffer)
        buffer.seek(0)

        filename = f"donor-feedback-{timezone.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=filename,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


class DonorListView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        latest_payment_subquery = Subquery(
            PaymentRecord.objects.filter(
                donor=OuterRef('pk'),
                status=PaymentStatus.SUCCESS,
            )
            .order_by('-created_at')
            .values('created_at')[:1]
        )

        donors = (
            User.objects.filter(role=UserRole.DONOR)
            .select_related('profile')
            .prefetch_related('family_members')
            .annotate(latest_payment_date=latest_payment_subquery)
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

    def get(self, request, pk: int):
        """Get donor details. Users can fetch their own details or parent donor details if linked."""
        donor = self.get_object(pk)

        # Allow access if:
        # 1. User is requesting their own details
        # 2. User is an admin
        # 3. User has a parent-child relationship with the donor
        if request.user.id != donor.id and request.user.role != UserRole.ADMIN:
            # Check if requesting user has this donor as a parent
            current_month = timezone.localdate().replace(day=1)
            mapping = CombinePaymentMapping.objects.filter(
                main_donor=request.user,
                parent_donor_id=pk,
            ).first()

            if not mapping or not mapping.is_active_on(current_month):
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        profile, _ = DonorProfile.objects.get_or_create(user=donor)
        return Response(
            {
                "user": UserSerializer(donor).data,
                "profile": DonorProfileSerializer(profile).data,
            },
            status=status.HTTP_200_OK,
        )

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


class NakshatraOptionViewSet(viewsets.ModelViewSet):
    queryset = NakshatraOption.objects.order_by("display_order", "name")
    serializer_class = NakshatraOptionSerializer
    permission_classes = (GothraOptionPermission,)

    def perform_create(self, serializer):
        max_order = NakshatraOption.objects.aggregate(Max("display_order")).get("display_order__max") or 0
        serializer.save(display_order=max_order + 1)


class RasiOptionViewSet(viewsets.ModelViewSet):
    queryset = RasiOption.objects.order_by("display_order", "name")
    serializer_class = RasiOptionSerializer
    permission_classes = (GothraOptionPermission,)

    def perform_create(self, serializer):
        max_order = RasiOption.objects.aggregate(Max("display_order")).get("display_order__max") or 0
        serializer.save(display_order=max_order + 1)
