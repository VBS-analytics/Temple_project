"""Payment routes."""

from rest_framework.routers import DefaultRouter

from .views import ExpenseRecordViewSet, PaymentRecordViewSet

router = DefaultRouter()
router.register('records', PaymentRecordViewSet, basename='payment-records')
router.register('expenses', ExpenseRecordViewSet, basename='expense-records')

urlpatterns = router.urls
