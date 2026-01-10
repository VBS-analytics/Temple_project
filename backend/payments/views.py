"""Payment API views."""

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

        with transaction.atomic():
            CombinePaymentMapping.objects.filter(main_donor=main_user).exclude(
                parent_donor__in=parent_users
            ).delete()

            for parent_user in parent_users:
                CombinePaymentMapping.objects.get_or_create(
                    main_donor=main_user,
                    parent_donor=parent_user,
                )

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
        deleted, _ = queryset.delete()
        if deleted == 0:
            return Response(
                {"detail": "No matching mappings found to delete."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class CombinePaymentAccessView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        main_user = request.user
        parent_mappings = (
            CombinePaymentMapping.objects.filter(main_donor=main_user)
            .select_related("parent_donor")
            .order_by("parent_donor_id")
        )

        if not parent_mappings.exists():
            return Response({"can_combine": False, "parent_donors": []})

        parent_ids = [mapping.parent_donor_id for mapping in parent_mappings]
        snapshots = {
            snapshot.donor_id: snapshot
            for snapshot in PoojaCartSnapshot.objects.filter(donor_id__in=parent_ids)
        }

        parent_donors = []
        for mapping in parent_mappings:
            snapshot = snapshots.get(mapping.parent_donor_id)
            parent_donors.append(
                {
                    "id": mapping.parent_donor.id,
                    "name": mapping.parent_donor.name,
                    "phone": mapping.parent_donor.phone_number,
                    "items": snapshot.items if snapshot else [],
                    "updated_at": snapshot.updated_at.isoformat() if snapshot else None,
                }
            )

        return Response(
            {
                "can_combine": True,
                "main_donor": {
                    "id": main_user.id,
                    "name": main_user.name,
                    "phone": main_user.phone_number,
                },
                "parent_donors": parent_donors,
            }
        )
