"""Payment routes."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CombinePaymentAccessView,
    CombinePaymentMappingView,
    ExpenseRecordViewSet,
    PaymentRecordViewSet,
)

router = DefaultRouter()
router.register('records', PaymentRecordViewSet, basename='payment-records')
router.register('expenses', ExpenseRecordViewSet, basename='expense-records')

urlpatterns = router.urls
urlpatterns += [
    path('combine-mappings/', CombinePaymentMappingView.as_view(), name='combine-payment-mappings'),
    path('combine-access/', CombinePaymentAccessView.as_view(), name='combine-payment-access'),
]
