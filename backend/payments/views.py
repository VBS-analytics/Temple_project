"""Payment API views."""

from django.db.models import Q
from rest_framework import permissions, viewsets

from accounts.models import UserRole

from .models import PaymentRecord
from .serializers import PaymentRecordSerializer


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
