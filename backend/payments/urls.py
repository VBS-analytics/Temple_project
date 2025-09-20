"""Payment routes."""

from rest_framework.routers import DefaultRouter

from .views import PaymentRecordViewSet

router = DefaultRouter()
router.register('records', PaymentRecordViewSet, basename='payment-records')

urlpatterns = router.urls
