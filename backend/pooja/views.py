"""ViewSets for pooja master data and registrations."""

from datetime import datetime

from django.db import transaction
from django.db.models import Max, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User, UserRole

from .models import (
    DailyMessage,
    DonorMessageTemplate,
    FeaturedPooja,
    PoojaCartSnapshot,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
    RecurringPoojaPlan,
)
from .services.calendar import get_calendar_service
from .serializers import (
    DailyMessageSerializer,
    DonorMessageTemplateSerializer,
    FeaturedPoojaSerializer,
    PoojaCartSnapshotSerializer,
    PoojaDayOptionSerializer,
    PoojaOptionSerializer,
    PoojaRegistrationSerializer,
    RecurringPoojaPlanSerializer,
    RecurringPoojaPlanUpdateSerializer,
    LandingPoojaRegistrationSerializer,
    PublicTodayPoojaRegistrationSerializer,
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

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            
            # Delete all child items first if this is a header
            if instance.is_group_header:
                # Use select_for_update to prevent race conditions
                children = PoojaOption.objects.select_for_update().filter(parent_id=instance.id)
                children.delete()
            
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except PoojaOption.DoesNotExist:
            return Response(
                {"detail": "This pooja item no longer exists"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                instance = self.get_object()
                
                # If this is a header, delete all children first
                if instance.is_group_header:
                    PoojaOption.objects.filter(parent_id=instance.id).delete()
                
                # Now delete the instance itself
                instance.delete()
                
                return Response(status=status.HTTP_204_NO_CONTENT)
        except PoojaOption.DoesNotExist:
            return Response(
                {"detail": "Pooja option no longer exists"},
                status=status.HTTP_404_NOT_FOUND
            )


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

    @action(detail=True, methods=["get"], url_path="next-occurrence")
    def next_occurrence(self, request, pk=None):
        day_option = self.get_object()
        start_date_str = request.query_params.get("start_date")
        if start_date_str:
            try:
                parsed = datetime.fromisoformat(start_date_str)
                start_date = parsed.date()
            except ValueError:
                return Response({"detail": "start_date must be in ISO format (YYYY-MM-DD)."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            start_date = timezone.localdate()

        tamil_star_labels = None
        tamil_star_id = request.query_params.get("tamil_star_id")
        if tamil_star_id is not None:
            try:
                star_option = PoojaDayOption.objects.get(id=int(tamil_star_id), category="tamil_star")
                tamil_star_labels = [star_option.description, star_option.code]
            except (ValueError, PoojaDayOption.DoesNotExist):
                return Response({"detail": "Invalid tamil_star_id provided."}, status=status.HTTP_400_BAD_REQUEST)

        service = get_calendar_service()
        try:
            occurrence = service.next_occurrence(day_option.code, start_date, tamil_star_labels=tamil_star_labels)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        payload = {
            "day_option_id": day_option.id,
            "day_option_code": day_option.code,
            "start_date": start_date.isoformat(),
            "occurrence_date": occurrence.date.isoformat(),
            "occurrence_label": occurrence.description,
            "meta": occurrence.meta,
        }
        return Response(payload)


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
        donor_id = self.request.query_params.get("donor_id")
        donor_phone = self.request.query_params.get("donor_phone")
        donor_search = self.request.query_params.get("donor")
        filters = Q()
        has_filters = False

        if donor_id:
            donor_id = donor_id.strip()
            if donor_id:
                try:
                    donor_id_value = int(donor_id)
                except ValueError:
                    donor_id_value = None
                if donor_id_value is not None:
                    filters &= Q(donor__id=donor_id_value)
                    has_filters = True

        if donor_phone:
            donor_phone = donor_phone.strip()
            if donor_phone:
                filters &= Q(donor__phone_number__icontains=donor_phone)
                has_filters = True

        if donor_search:
            donor_search = donor_search.strip()
            if donor_search:
                search_filters = Q(donor__phone_number__icontains=donor_search)
                if donor_search.isdigit():
                    search_filters |= Q(donor__id=int(donor_search))
                filters &= search_filters
                has_filters = True

        if self.request.user.role == UserRole.ADMIN:
            queryset = base_qs
        else:
            queryset = base_qs.filter(donor=self.request.user)

        if has_filters:
            queryset = queryset.filter(filters)

        return queryset.prefetch_related("members")

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

    @action(detail=False, methods=["get"], url_path="donor-directory")
    def donor_directory(self, request):
        qs = User.objects.filter(role=UserRole.DONOR)
        if request.user.is_authenticated and request.user.role == UserRole.DONOR:
            qs = qs.exclude(id=request.user.id)
        donors = qs.order_by("name", "id").values("id", "name", "phone_number")
        payload = [
            {
                "id": entry["id"],
                "name": entry["name"] or "",
                "phone_number": entry["phone_number"] or "",
            }
        for entry in donors
        ]
        return Response(payload)


class RecurringPoojaPlanViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = RecurringPoojaPlanSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = RecurringPoojaPlan.objects.select_related("pooja_option", "day_option")
        if self.request.user.role == UserRole.ADMIN:
            return qs.order_by("donor__name", "-next_occurrence", "-created_at")
        return qs.filter(donor=self.request.user).order_by("-next_occurrence", "-created_at")

    def get_serializer_class(self):
        if self.action in ('partial_update', 'update'):
            return RecurringPoojaPlanUpdateSerializer
        return RecurringPoojaPlanSerializer

    def get_object(self):
        plan = super().get_object()
        self._ensure_plan_access(plan)
        return plan

    def _ensure_plan_access(self, plan: RecurringPoojaPlan) -> None:
        if self.request.user.role == UserRole.ADMIN:
            return
        if plan.donor_id != self.request.user.id:
            raise PermissionDenied("You can only manage your own recurring plans.")

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        plan = self.get_object()
        pause_from_value = request.data.get("pause_from")
        pause_until_value = request.data.get("pause_until")
        if not pause_until_value:
            return Response({"detail": "Provide a pause_until date."}, status=status.HTTP_400_BAD_REQUEST)
        pause_until = parse_date(pause_until_value)
        if pause_until is None:
            return Response({"detail": "Invalid date provided for pause_until."}, status=status.HTTP_400_BAD_REQUEST)
        pause_from = parse_date(pause_from_value) if pause_from_value else timezone.localdate()
        if pause_from is None:
            return Response({"detail": "Invalid date provided for pause_from."}, status=status.HTTP_400_BAD_REQUEST)
        today = timezone.localdate()
        if pause_from < today:
            return Response({"detail": "Pause start must be today or later."}, status=status.HTTP_400_BAD_REQUEST)
        if pause_until <= pause_from:
            return Response({"detail": "Pause end must be after the pause start."}, status=status.HTTP_400_BAD_REQUEST)
        plan.pause_from = pause_from
        plan.pause_until = pause_until
        plan.is_active = False
        plan.save()
        serializer = self.get_serializer(plan)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="resume")
    def resume(self, request, pk=None):
        plan = self.get_object()
        plan.pause_until = None
        plan.pause_from = None
        plan.is_active = True
        plan.save()
        serializer = self.get_serializer(plan)
        return Response(serializer.data)


class PoojaCartSnapshotView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def _ensure_donor(self, request):
        if request.user.role != UserRole.DONOR:
            raise PermissionDenied("Only donor accounts can manage cart snapshots.")

    def get(self, request):
        self._ensure_donor(request)
        snapshot, _ = PoojaCartSnapshot.objects.get_or_create(donor=request.user)
        serializer = PoojaCartSnapshotSerializer(snapshot)
        return Response(serializer.data)

    def put(self, request):
        self._ensure_donor(request)
        snapshot, _ = PoojaCartSnapshot.objects.get_or_create(donor=request.user)
        serializer = PoojaCartSnapshotSerializer(instance=snapshot, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PoojaCartSnapshotAssignView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        donor_id_raw = request.data.get("donor_id")
        if donor_id_raw is None:
            return Response(
                {"detail": "donor_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            donor_id = int(donor_id_raw)
        except (TypeError, ValueError):
            return Response({"detail": "donor_id must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        donor_user = User.objects.filter(id=donor_id, role=UserRole.DONOR).first()
        if donor_user is None:
            return Response({"detail": "Donor not found."}, status=status.HTTP_404_NOT_FOUND)

        if donor_user != request.user and request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Cannot update snapshots for other donors.")

        snapshot, _ = PoojaCartSnapshot.objects.get_or_create(donor=donor_user)
        serializer = PoojaCartSnapshotSerializer(instance=snapshot, data={"items": request.data.get("items", [])})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CombinePaymentLookupView(APIView):
    """Fetch cart selections for a donor to support group / combined payments."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        donor_id_raw = request.query_params.get("donor_id")
        donor_phone_raw = request.query_params.get("phone")

        if not donor_id_raw and not donor_phone_raw:
            return Response(
                {"detail": "Provide a donor_id or phone query parameter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        donor_user = None

        if donor_id_raw:
            try:
                donor_id = int(donor_id_raw)
            except (TypeError, ValueError):
                return Response({"detail": "Invalid donor_id provided."}, status=status.HTTP_400_BAD_REQUEST)
            donor_user = User.objects.filter(id=donor_id, role=UserRole.DONOR).first()
        else:
            donor_phone = (donor_phone_raw or "").strip()
            if not donor_phone:
                return Response({"detail": "Provide a donor phone number."}, status=status.HTTP_400_BAD_REQUEST)
            donor_user = User.objects.filter(phone_number__iexact=donor_phone, role=UserRole.DONOR).first()

        if donor_user is None:
            return Response({"detail": "Donor not found."}, status=status.HTTP_404_NOT_FOUND)

        snapshot = PoojaCartSnapshot.objects.filter(donor=donor_user).first()
        items = snapshot.items if snapshot else []

        payload = {
            "donor_id": donor_user.id,
            "donor_name": donor_user.name,
            "donor_phone": donor_user.phone_number,
            "items": items,
        }
        return Response(payload)


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


class TodayPoojaRegistrationsPublicView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        today = timezone.localdate()
        queryset = (
            PoojaRegistration.objects.select_related("pooja_option", "day_option", "donor")
            .prefetch_related("members")
            .filter(start_date=today)
            .order_by("-created_at")
        )
        serializer = PublicTodayPoojaRegistrationSerializer(queryset, many=True)
        return Response({"count": len(serializer.data), "results": serializer.data})
