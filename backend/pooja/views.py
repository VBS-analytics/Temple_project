"""ViewSets for pooja master data and registrations."""

from django.db import transaction
from django.db.models import Max, Prefetch
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole

from .models import (
    DailyMessage,
    DonorMessageTemplate,
    FeaturedPooja,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
)
from .serializers import (
    DailyMessageSerializer,
    DonorMessageTemplateSerializer,
    FeaturedPoojaSerializer,
    PoojaDayOptionSerializer,
    PoojaOptionSerializer,
    PoojaRegistrationSerializer,
    LandingPoojaRegistrationSerializer,
)


class IsAdminRole(permissions.BasePermission):
    """Allows access only to users flagged as admin role."""

    def has_permission(self, request, view):  # pragma: no cover - simple predicate
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.ADMIN)


class ReadOnlyOrAdmin(permissions.BasePermission):
    """Donors can read, only admins can modify."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.ADMIN)


class PoojaOptionViewSet(viewsets.ModelViewSet):
    queryset = PoojaOption.objects.select_related("parent").prefetch_related("children")
    serializer_class = PoojaOptionSerializer
    permission_classes = (ReadOnlyOrAdmin,)


class PoojaDayOptionViewSet(viewsets.ModelViewSet):
    queryset = PoojaDayOption.objects.all()
    serializer_class = PoojaDayOptionSerializer
    permission_classes = (ReadOnlyOrAdmin,)

    def perform_create(self, serializer):  # pragma: no cover - simple aggregate call
        max_order = PoojaDayOption.objects.aggregate(Max("display_order")).get("display_order__max") or 0
        serializer.save(display_order=max_order + 1)

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        ordered_ids = request.data.get("order")
        if not isinstance(ordered_ids, list) or not all(isinstance(item, int) for item in ordered_ids):
            return Response({"detail": "Order must be a list of IDs."}, status=status.HTTP_400_BAD_REQUEST)

        existing_ids = set(PoojaDayOption.objects.filter(id__in=ordered_ids).values_list("id", flat=True))
        if len(existing_ids) != len(ordered_ids):
            return Response({"detail": "One or more IDs are invalid."}, status=status.HTTP_400_BAD_REQUEST)

        remaining_ids = list(
            PoojaDayOption.objects.exclude(id__in=ordered_ids).order_by("display_order", "id").values_list("id", flat=True)
        )
        final_order = [*ordered_ids, *remaining_ids]

        with transaction.atomic():
            for position, option_id in enumerate(final_order, start=1):
                PoojaDayOption.objects.filter(id=option_id).update(display_order=position)

        return Response({"detail": "Day options reordered."})


class FeaturedPoojaViewSet(viewsets.ModelViewSet):
    queryset = FeaturedPooja.objects.all()
    serializer_class = FeaturedPoojaSerializer

    def get_permissions(self):  # pragma: no cover - simple branching
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsAdminRole()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_authenticated and self.request.user.role == UserRole.ADMIN:
            return qs
        return qs.filter(is_active=True)


class DailyMessageViewSet(viewsets.ModelViewSet):
    queryset = DailyMessage.objects.all()
    serializer_class = DailyMessageSerializer
    permission_classes = (ReadOnlyOrAdmin,)


class DonorMessageTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = DonorMessageTemplateSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = DonorMessageTemplate.objects.filter(donor=self.request.user).select_related("day_option")
        return qs

    def perform_create(self, serializer):
        serializer.save(donor=self.request.user)


class PoojaRegistrationViewSet(viewsets.ModelViewSet):
    serializer_class = PoojaRegistrationSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        base_qs = PoojaRegistration.objects.select_related("pooja_option", "day_option", "donor")
        if self.request.user.role == UserRole.ADMIN:
            return base_qs.prefetch_related("members")
        return base_qs.filter(donor=self.request.user).prefetch_related("members")

    def perform_create(self, serializer):
        serializer.save(donor=self.request.user)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.get_queryset()
        if request.user.role == UserRole.ADMIN:
            queryset = queryset.filter(donor=request.user)
        queryset = queryset.prefetch_related(Prefetch("members"))
        data = PoojaRegistrationSerializer(queryset, many=True, context={"request": request}).data
        return Response({"count": len(data), "results": data})

    @action(detail=False, methods=["get"], url_path="admin-overview")
    def admin_overview(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.select_related("donor", "pooja_option", "day_option")
            .prefetch_related("members")
            .order_by("donor__name", "donor_id", "-created_at")
        )

        grouped = {}
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                # Should not happen, but skip defensively
                continue
            donor_id = donor.id
            if donor_id not in grouped:
                grouped[donor_id] = {
                    "donor_id": donor_id,
                    "donor_name": donor.name,
                    "donor_phone": getattr(donor, "phone_number", ""),
                    "donor_email": getattr(donor, "email", None),
                    "registrations": [],
                }
            grouped[donor_id]["registrations"].append(registration)

        serializer_context = {"request": request}
        results = []
        for group in grouped.values():
            serialized_registrations = PoojaRegistrationSerializer(
                group["registrations"], many=True, context=serializer_context
            ).data
            results.append(
                {
                    "donor_id": group["donor_id"],
                    "donor_name": group["donor_name"],
                    "donor_phone": group["donor_phone"],
                    "donor_email": group["donor_email"],
                    "registrations": serialized_registrations,
                }
            )

        results.sort(key=lambda item: (item["donor_name"] or "").lower())
        return Response({"count": len(results), "results": results})


class RecentPoojaRegistrationsView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        queryset = (
            PoojaRegistration.objects.select_related("pooja_option", "day_option", "donor")
            .filter(status__in=("confirmed", "completed"))
            .order_by("-created_at")[:5]
        )
        serializer = LandingPoojaRegistrationSerializer(queryset, many=True)
        return Response({"count": len(serializer.data), "results": serializer.data})
