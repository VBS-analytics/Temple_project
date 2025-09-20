"""Payment API views."""

from rest_framework import permissions, viewsets

from accounts.models import UserRole

from .models import PaymentRecord
from .serializers import PaymentRecordSerializer


class PaymentRecordViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentRecordSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = PaymentRecord.objects.select_related("donor", "registration", "registration__pooja_option")
        if self.request.user.role == UserRole.ADMIN:
            return qs
        return qs.filter(donor=self.request.user)

    def perform_create(self, serializer):
        serializer.save()
