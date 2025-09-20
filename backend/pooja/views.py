"""ViewSets for pooja master data and registrations."""

from django.db.models import Prefetch
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import UserRole

from .models import (
    DailyMessage,
    DonorMessageTemplate,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
)
from .serializers import (
    DailyMessageSerializer,
    DonorMessageTemplateSerializer,
    PoojaDayOptionSerializer,
    PoojaOptionSerializer,
    PoojaRegistrationSerializer,
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
    queryset = PoojaOption.objects.all()
    serializer_class = PoojaOptionSerializer
    permission_classes = (ReadOnlyOrAdmin,)


class PoojaDayOptionViewSet(viewsets.ModelViewSet):
    queryset = PoojaDayOption.objects.all()
    serializer_class = PoojaDayOptionSerializer
    permission_classes = (ReadOnlyOrAdmin,)


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
        qs = self.get_queryset().prefetch_related(Prefetch("members"))
        data = PoojaRegistrationSerializer(qs, many=True, context={"request": request}).data
        return Response({"count": len(data), "results": data})
