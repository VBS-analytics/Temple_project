"""Payment API views."""

from datetime import date

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User, UserRole
from common.permissions import IsAdminRole
from pooja.models import PoojaCartSnapshot

from .models import CombinePaymentMapping, ExpenseRecord, PaymentRecord
from .serializers import ExpenseRecordSerializer, PaymentRecordSerializer


def _parse_month_key(value):
    if value is None:
        return None
    raw = value.strip() if isinstance(value, str) else str(value).strip()
    if not raw:
        return None
    parts = raw.split("-", 1)
    if len(parts) != 2:
        return None
    try:
        year = int(parts[0])
        month = int(parts[1])
    except ValueError:
        return None
    if month < 1 or month > 12:
        return None
    return date(year, month, 1)


class PaymentRecordViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentRecordSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = (
            PaymentRecord.objects.select_related("donor", "registration", "registration__pooja_option")
            .prefetch_related("registration__payments")
        )
        donor_id_param = self.request.query_params.get("donor_id")
        donor_phone_param = self.request.query_params.get("donor_phone")
        donor_search = self.request.query_params.get("donor")
        filters = Q()
        has_filters = False

        if donor_id_param:
            donor_id_param = donor_id_param.strip()
            if donor_id_param:
                try:
                    donor_id_value = int(donor_id_param)
                except ValueError:
                    donor_id_value = None
                if donor_id_value is not None:
                    filters &= Q(donor__id=donor_id_value)
                    has_filters = True

        if donor_phone_param:
            donor_phone_param = donor_phone_param.strip()
            if donor_phone_param:
                filters &= Q(donor__phone_number__icontains=donor_phone_param)
                has_filters = True

        if donor_search:
            donor_search = donor_search.strip()
            if donor_search:
                search_filters = Q(donor__phone_number__icontains=donor_search)
                if donor_search.isdigit():
                    search_filters |= Q(donor__id=int(donor_search))
                filters &= search_filters
                has_filters = True

        if has_filters:
            qs = qs.filter(filters)

        if self.request.user.role == UserRole.ADMIN:
            return qs

        current_month = timezone.localdate().replace(day=1)
        subordinate_mappings = CombinePaymentMapping.objects.filter(parent_donor=self.request.user)
        for mapping in subordinate_mappings:
            if mapping.is_active_on(current_month):
                return qs.none()

        active_parent_ids = {
            mapping.parent_donor_id
            for mapping in CombinePaymentMapping.objects.filter(main_donor=self.request.user)
            if mapping.is_active_on(current_month) and mapping.parent_donor_id is not None
        }
        if active_parent_ids:
            return qs.filter(Q(donor=self.request.user) | Q(donor_id__in=active_parent_ids))
        return qs.filter(donor=self.request.user)

    def perform_create(self, serializer):
        serializer.save()


class ExpenseRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseRecordSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        queryset = ExpenseRecord.objects.all()
        if self.request.user.role != UserRole.ADMIN:
            queryset = queryset.filter(created_by=self.request.user)

        month_param = self.request.query_params.get("month")
        if month_param:
            try:
                year, month = map(int, month_param.split("-", 1))
            except ValueError:
                pass
            else:
                queryset = queryset.filter(transaction_date__year=year, transaction_date__month=month)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CombinePaymentMappingView(APIView):
    permission_classes = (IsAdminRole,)

    def _group_timestamps(self, first, second):
        if first is None:
            return second
        if second is None:
            return first
        return second if second > first else first

    def _entry_payload(self, main_user, parent_mappings, saved_at):
        saved_at_value = saved_at or timezone.now()
        return {
            "main_donor": {
                "id": main_user.id,
                "name": main_user.name,
                "phone": main_user.phone_number,
            },
            "parent_donors": [
                {
                    "id": mapping.parent_donor.id,
                    "name": mapping.parent_donor.name,
                    "phone": mapping.parent_donor.phone_number,
                    "effective_from": mapping.effective_from.isoformat() if mapping.effective_from else None,
                    "effective_to": mapping.effective_to.isoformat() if mapping.effective_to else None,
                    "active": mapping.is_active_on(),
                }
                for mapping in parent_mappings
            ],
            "saved_at": saved_at_value.isoformat(),
        }

    def get(self, request):
        mappings = (
            CombinePaymentMapping.objects.select_related("main_donor", "parent_donor")
            .order_by("-updated_at", "-created_at")
            .all()
        )
        grouped: dict[int, dict] = {}
        for mapping in mappings:
            saved_at = mapping.updated_at or mapping.created_at
            entry = grouped.get(mapping.main_donor_id)
            if entry is None:
                entry = {
                    "main_user": mapping.main_donor,
                    "parent_mappings": [],
                    "saved_at": saved_at,
                }
                grouped[mapping.main_donor_id] = entry
            entry["parent_mappings"].append(mapping)
            entry["saved_at"] = self._group_timestamps(entry["saved_at"], saved_at)

        payload = [
            self._entry_payload(group["main_user"], group["parent_mappings"], group["saved_at"])
            for group in grouped.values()
        ]
        return Response(payload)

    def post(self, request):
        main_phone = (request.data.get("main_phone") or "").strip()
        parent_phones = request.data.get("parent_phones") or []

        if not main_phone:
            return Response(
                {"detail": "Main donor phone number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(parent_phones, list):
            return Response(
                {"detail": "parent_phones must be a list of phone numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cleaned_parents = [phone.strip() for phone in parent_phones if phone and phone.strip()]
        cleaned_parents = list(dict.fromkeys(cleaned_parents))
        if not cleaned_parents:
            return Response(
                {"detail": "Provide at least one parent donor phone number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        main_user = User.objects.filter(phone_number__iexact=main_phone).first()
        if main_user is None:
            return Response({"detail": "Main donor not found."}, status=status.HTTP_400_BAD_REQUEST)

        parent_users = []
        for parent_phone in cleaned_parents:
            if parent_phone.casefold() == main_user.phone_number.casefold():
                continue
            parent_user = User.objects.filter(phone_number__iexact=parent_phone).first()
            if parent_user is None:
                return Response(
                    {"detail": f"Parent donor not found: {parent_phone}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            parent_users.append(parent_user)

        if not parent_users:
            return Response(
                {"detail": "Valid parent donor phone numbers are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        effective_month_raw = request.data.get("effective_month")
        effective_month = None
        if effective_month_raw not in (None, ''):
            effective_month = _parse_month_key(effective_month_raw)
            if effective_month is None:
                return Response(
                    {"detail": "Provide a valid effective_month in YYYY-MM format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        uncombine_present = "uncombine_month" in request.data
        uncombine_month_raw = request.data.get("uncombine_month")
        uncombine_month = None
        if uncombine_present and uncombine_month_raw not in (None, ''):
            uncombine_month = _parse_month_key(uncombine_month_raw)
            if uncombine_month is None:
                return Response(
                    {"detail": "Provide a valid uncombine_month in YYYY-MM format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if effective_month and uncombine_month and uncombine_month <= effective_month:
            return Response(
                {"detail": "Uncombine month must be after the effective month."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            CombinePaymentMapping.objects.filter(main_donor=main_user).exclude(
                parent_donor__in=parent_users
            ).delete()

            for parent_user in parent_users:
                mapping, _ = CombinePaymentMapping.objects.get_or_create(
                    main_donor=main_user,
                    parent_donor=parent_user,
                )
                if effective_month:
                    mapping.effective_from = effective_month
                if uncombine_present:
                    mapping.effective_to = uncombine_month
                mapping.save()

        mapping_list = list(
            CombinePaymentMapping.objects.filter(main_donor=main_user).select_related("parent_donor")
        )
        if mapping_list:
            timestamp_candidates = [
                mapping.updated_at or mapping.created_at or timezone.now() for mapping in mapping_list
            ]
            saved_at = max(timestamp_candidates)
        else:
            saved_at = timezone.now()
        payload = self._entry_payload(main_user, mapping_list, saved_at)
        return Response(payload, status=status.HTTP_201_CREATED)

    def delete(self, request):
        main_phone = (request.data.get("main_phone") or request.query_params.get("main_phone") or "").strip()
        parent_phones = request.data.get("parent_phones") or []

        if not main_phone:
            return Response(
                {"detail": "Main donor phone number is required for deletion."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        main_user = User.objects.filter(phone_number__iexact=main_phone).first()
        if main_user is None:
            return Response({"detail": "Main donor not found."}, status=status.HTTP_400_BAD_REQUEST)

        cleaned_parents = []
        if isinstance(parent_phones, list):
            cleaned_parents = [phone.strip() for phone in parent_phones if phone and phone.strip()]
        parent_users = []
        for parent_phone in cleaned_parents:
            user = User.objects.filter(phone_number__iexact=parent_phone).first()
            if user:
                parent_users.append(user)

        queryset = CombinePaymentMapping.objects.filter(main_donor=main_user)
        if parent_users:
            queryset = queryset.filter(parent_donor__in=parent_users)
        uncombine_present = "uncombine_month" in request.data or "uncombine_month" in request.query_params
        uncombine_raw = (
            request.data.get("uncombine_month")
            if "uncombine_month" in request.data
            else request.query_params.get("uncombine_month")
        )
        target_uncombine = None
        if uncombine_present and uncombine_raw not in (None, ''):
            target_uncombine = _parse_month_key(uncombine_raw)
            if target_uncombine is None:
                return Response(
                    {"detail": "Provide a valid uncombine_month in YYYY-MM format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not uncombine_present:
            deleted, _ = queryset.delete()
            if deleted == 0:
                return Response(
                    {"detail": "No matching mappings found to delete."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(status=status.HTTP_204_NO_CONTENT)

        mappings = list(queryset.select_related("parent_donor"))
        if not mappings:
            return Response(
                {"detail": "No matching mappings found to uncombine."},
                status=status.HTTP_404_NOT_FOUND,
            )
        for mapping in mappings:
            if target_uncombine and target_uncombine <= mapping.effective_from:
                return Response(
                    {
                        "detail": (
                            f"Uncombine month must be after "
                            f"{mapping.effective_from.strftime('%Y-%m')} for parent donor "
                            f"{mapping.parent_donor.phone_number}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            mapping.effective_to = target_uncombine
            mapping.save()
        return Response(status=status.HTTP_200_OK)


class CombinePaymentAccessView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        current_month = timezone.localdate().replace(day=1)

        subordinate_mappings = (
            CombinePaymentMapping.objects.filter(parent_donor=user)
            .select_related("main_donor")
            .order_by("-effective_from")
        )
        for mapping in subordinate_mappings:
            if mapping.is_active_on(current_month):
                main_donor = mapping.main_donor
                return Response(
                    {
                        "role": "subordinate",
                        "can_combine": False,
                        "main_donor": {
                            "id": user.id,
                            "name": user.name,
                            "phone": user.phone_number,
                        },
                        "combined_to": {
                            "id": main_donor.id,
                            "name": main_donor.name,
                            "phone": main_donor.phone_number,
                            "effective_from": mapping.effective_from.isoformat()
                            if mapping.effective_from
                            else None,
                            "effective_to": mapping.effective_to.isoformat()
                            if mapping.effective_to
                            else None,
                        },
                        "parent_donors": [],
                    }
                )

        parent_mappings = (
            CombinePaymentMapping.objects.filter(main_donor=user)
            .select_related("parent_donor")
            .order_by("parent_donor_id")
        )
        if not parent_mappings.exists():
            return Response(
                {
                    "role": "main",
                    "can_combine": False,
                    "main_donor": {
                        "id": user.id,
                        "name": user.name,
                        "phone": user.phone_number,
                    },
                    "parent_donors": [],
                }
            )

        active_parent_mappings = [m for m in parent_mappings if m.is_active_on(current_month)]
        parent_ids = [mapping.parent_donor_id for mapping in active_parent_mappings if mapping.parent_donor_id]
        snapshots = {
            snapshot.donor_id: snapshot
            for snapshot in PoojaCartSnapshot.objects.filter(donor_id__in=parent_ids)
        }

        parent_donors = []
        for mapping in active_parent_mappings:
            snapshot = snapshots.get(mapping.parent_donor_id)
            parent_donors.append(
                {
                    "id": mapping.parent_donor.id,
                    "name": mapping.parent_donor.name,
                    "phone": mapping.parent_donor.phone_number,
                    "effective_from": mapping.effective_from.isoformat() if mapping.effective_from else None,
                    "effective_to": mapping.effective_to.isoformat() if mapping.effective_to else None,
                    "active": mapping.is_active_on(current_month),
                    "items": snapshot.items if snapshot else [],
                    "updated_at": snapshot.updated_at.isoformat() if snapshot else None,
                }
            )

        return Response(
            {
                "role": "main",
                "can_combine": bool(parent_donors),
                "main_donor": {
                    "id": user.id,
                    "name": user.name,
                    "phone": user.phone_number,
                },
                "parent_donors": parent_donors,
            }
        )
