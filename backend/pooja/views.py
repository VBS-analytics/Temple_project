"""ViewSets for pooja master data and registrations."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import date, datetime

from django.db import transaction
from django.db.models import Max, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import DonorProfile, User, UserRole
from common.permissions import IsAdminRole, ReadOnlyOrAdmin

from .models import (
    DailyMessage,
    DonorMessageTemplate,
    FeaturedPooja,
    PoojaCartSnapshot,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
    RecurrenceKind,
    RecurringPoojaPlan,
)
from .services.calendar import get_calendar_service
from .services.recurrence import (
    calculate_next_recurring_occurrence,
    find_due_registration,
    prepare_recurring_registration,
    sum_successful_payments,
)
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

PAUSE_REASON_NO_POJA_NO_PAYMENT = "No Pooja and No Payment"
PAUSE_REASON_USE_FOR_TEMPLE = "No Pooja and use the money for temple purpose"
PAUSE_REASON_SAMY = "Continue the pooja with the Samy's names"

SATURDAY_NAVAGRAHA_POOJA_NAME = "4 saturday navagraha pooja per month"
PRADOSHA_POOJA_NAME = "2 pradosha pooja per month"
TILL_OIL_FOR_LAMPS_NAME = "till oil for lamps"
NITYA_NEIVEDHYAM_NAME = "nitya neivedhyam"
GAU_SAMRAKHSHANA_SEVA_NAME = "gau samrakshana seva"


def _is_registration_in_pause_window(registration, pause_start):
    if registration is None:
        return False
    registration_date = getattr(registration, "start_date", None)
    if registration_date is None:
        return False
    return registration_date >= pause_start


def _round_to_whole_rupee(amount: Decimal) -> int:
    return int(amount.to_integral_value(rounding=ROUND_HALF_UP))


def _credit_custom_balance(user, amount: Decimal):
    if amount <= Decimal("0.00"):
        return
    profile, _ = DonorProfile.objects.get_or_create(user=user)
    profile.custom_number = (profile.custom_number or 0) + _round_to_whole_rupee(amount)
    profile.save(update_fields=["custom_number"])


def _credit_monthly_donation(user, amount: Decimal):
    if amount <= Decimal("0.00"):
        return
    profile, _ = DonorProfile.objects.get_or_create(user=user)
    profile.monthly_donation_amount = (profile.monthly_donation_amount or Decimal("0.00")) + amount
    profile.save(update_fields=["monthly_donation_amount"])


def _debit_monthly_donation(user, amount: Decimal):
    if amount <= Decimal("0.00"):
        return
    profile, _ = DonorProfile.objects.get_or_create(user=user)
    current_value = profile.monthly_donation_amount or Decimal("0.00")
    updated_value = max(current_value - amount, Decimal("0.00"))
    if updated_value == current_value:
        return
    profile.monthly_donation_amount = updated_value
    profile.save(update_fields=["monthly_donation_amount"])


def _debit_custom_balance(user, amount):
    if amount is None or amount <= Decimal("0.00"):
        return
    deduction = _round_to_whole_rupee(amount)
    if deduction <= 0:
        return
    profile, _ = DonorProfile.objects.get_or_create(user=user)
    current_balance = profile.custom_number or 0
    profile.custom_number = max(current_balance - deduction, 0)
    profile.save(update_fields=["custom_number"])


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
        tamil_star_label = request.query_params.get("tamil_star")
        if tamil_star_id is not None:
            try:
                star_option = PoojaDayOption.objects.get(id=int(tamil_star_id), category="tamil_star")
                tamil_star_labels = [star_option.description, star_option.code]
            except (ValueError, PoojaDayOption.DoesNotExist):
                return Response({"detail": "Invalid tamil_star_id provided."}, status=status.HTTP_400_BAD_REQUEST)
        elif tamil_star_label:
            tamil_star_labels = [tamil_star_label]

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

    @action(detail=False, methods=["get"], url_path="saturday-navagraha-report")
    def saturday_navagraha_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=SATURDAY_NAVAGRAHA_POOJA_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("donor__name", "donor__id", "start_date")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="pradosha-pooja-report")
    def pradosha_pooja_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=PRADOSHA_POOJA_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("start_date", "donor__name", "donor__id")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="till-oil-for-lamps-report")
    def till_oil_for_lamps_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=TILL_OIL_FOR_LAMPS_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("start_date", "donor__name", "donor__id")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="nitya-neivedhyam-report")
    def nitya_neivedhyam_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=NITYA_NEIVEDHYAM_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("start_date", "donor__name", "donor__id")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="gau-samrakshana-seva-report")
    def gau_samrakshana_seva_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=GAU_SAMRAKHSHANA_SEVA_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("start_date", "donor__name", "donor__id")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})


class RecurringPoojaPlanViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = RecurringPoojaPlanSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def list(self, request, *args, **kwargs):
        self._auto_resume_expired_pauses()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = RecurringPoojaPlan.objects.select_related(
            "donor", "pooja_option", "day_option", "origin_registration"
        )
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
        self._reactivate_plan(plan)
        return plan

    def _ensure_plan_access(self, plan: RecurringPoojaPlan) -> None:
        if self.request.user.role == UserRole.ADMIN:
            return
        if plan.donor_id != self.request.user.id:
            raise PermissionDenied("You can only manage your own recurring plans.")

    def _auto_resume_expired_pauses(self) -> None:
        today = timezone.localdate()
        queryset = self.filter_queryset(self.get_queryset())
        expired_plans = queryset.filter(
            pause_until__isnull=False,
            pause_until__lt=today,
            recurrence_kind=RecurrenceKind.RECURRING,
        )
        for plan in expired_plans:
            self._reactivate_plan(plan, reference_date=today)

    def _reactivate_plan(
        self,
        plan: RecurringPoojaPlan,
        *,
        reference_date=None,
        force: bool = False,
        additional_metadata_keys=None,
    ) -> bool:
        if plan.recurrence_kind != RecurrenceKind.RECURRING:
            return False
        today = reference_date or timezone.localdate()
        if not force and (plan.pause_until is None or plan.pause_until >= today):
            return False
        plan.pause_from = None
        plan.pause_until = None
        plan.is_active = True
        metadata = dict(plan.metadata or {})
        metadata.pop("pause_reason", None)
        metadata.pop("pause_handling_amount", None)
        for key in additional_metadata_keys or ():
            metadata.pop(key, None)
        plan.metadata = metadata
        next_occurrence = calculate_next_recurring_occurrence(plan, reference_date=today)
        if next_occurrence:
            plan.next_occurrence = next_occurrence
        plan.save(update_fields=["pause_from", "pause_until", "is_active", "metadata", "next_occurrence"])
        return True

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        plan = self.get_object()
        pause_from_value = request.data.get("pause_from")
        pause_until_value = request.data.get("pause_until")
        pause_reason_value = request.data.get("pause_reason")
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
        metadata = dict(plan.metadata or {})
        due_registration = find_due_registration(plan, pause_from)
        paid_amount = sum_successful_payments(due_registration)
        if pause_reason_value == PAUSE_REASON_NO_POJA_NO_PAYMENT:
            _credit_custom_balance(plan.donor, paid_amount)
        elif pause_reason_value == PAUSE_REASON_USE_FOR_TEMPLE:
            if paid_amount > Decimal("0.00") and _is_registration_in_pause_window(due_registration, pause_from):
                _credit_monthly_donation(plan.donor, paid_amount)
        elif pause_reason_value == PAUSE_REASON_SAMY and paid_amount > Decimal("0.00"):
            metadata["handled_for_samy"] = True
        if pause_reason_value:
            metadata["pause_reason"] = pause_reason_value
        else:
            metadata.pop("pause_reason", None)
        if paid_amount > Decimal("0.00"):
            metadata["pause_handling_amount"] = str(paid_amount)
        plan.metadata = metadata
        plan.pause_from = pause_from
        plan.pause_until = pause_until
        plan.is_active = False
        plan.save()
        serializer = self.get_serializer(plan)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="resume")
    def resume(self, request, pk=None):
        plan = self.get_object()
        was_paused = bool(plan.pause_until or plan.pause_from or not plan.is_active)
        pause_metadata = dict(plan.metadata or {})
        pause_reason = pause_metadata.get("pause_reason")
        pause_handling_amount = pause_metadata.get("pause_handling_amount")
        pause_until = plan.pause_until
        reactivated = self._reactivate_plan(
            plan,
            force=True,
            additional_metadata_keys=("canceled_at",),
        )
        if reactivated and was_paused:
            _debit_custom_balance(plan.donor, plan.amount)
            if (
                pause_reason == PAUSE_REASON_USE_FOR_TEMPLE
                and pause_handling_amount
                and pause_until
                and pause_until > timezone.localdate()
            ):
                try:
                    amount_to_reverse = Decimal(pause_handling_amount)
                except (InvalidOperation, TypeError):
                    amount_to_reverse = Decimal("0.00")
                _debit_monthly_donation(plan.donor, amount_to_reverse)
        serializer = self.get_serializer(plan)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="prepare-payment")
    def prepare_payment(self, request, pk=None):
        plan = self.get_object()
        if plan.recurrence_kind != RecurrenceKind.RECURRING or not plan.is_active:
            return Response(
                {"detail": "Only active recurring plans can be prepared for payment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        registration = prepare_recurring_registration(plan)
        if registration is None:
            return Response(
                {
                    "detail": "Unable to prepare the registration for payment at this time."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = PoojaRegistrationSerializer(registration, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        plan = self.get_object()
        plan.pause_from = None
        plan.pause_until = None
        plan.is_active = False
        plan.next_occurrence = None
        metadata = dict(plan.metadata or {})
        metadata.pop("pause_reason", None)
        metadata["canceled_at"] = timezone.localdate().isoformat()
        plan.metadata = metadata
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
