"""Routes for pooja domain."""

from rest_framework.routers import DefaultRouter

from .views import (
    DailyMessageViewSet,
    DonorMessageTemplateViewSet,
    FeaturedPoojaViewSet,
    PoojaDayOptionViewSet,
    PoojaOptionViewSet,
    PoojaRegistrationViewSet,
)

router = DefaultRouter()
router.register('options', PoojaOptionViewSet, basename='pooja-options')
router.register('day-options', PoojaDayOptionViewSet, basename='pooja-day-options')
router.register('daily-messages', DailyMessageViewSet, basename='pooja-daily-messages')
router.register('donor-messages', DonorMessageTemplateViewSet, basename='pooja-donor-messages')
router.register('registrations', PoojaRegistrationViewSet, basename='pooja-registrations')
router.register('featured-poojas', FeaturedPoojaViewSet, basename='featured-poojas')

urlpatterns = router.urls
