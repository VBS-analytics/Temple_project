"""Routes for pooja domain."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DailyMessageViewSet,
    DonorMessageTemplateViewSet,
    FeaturedPoojaViewSet,
    PoojaDayOptionViewSet,
    PoojaOptionViewSet,
    PoojaRegistrationViewSet,
    RecentPoojaRegistrationsView,
)

router = DefaultRouter()
router.register('options', PoojaOptionViewSet, basename='pooja-options')
router.register('day-options', PoojaDayOptionViewSet, basename='pooja-day-options')
router.register('daily-messages', DailyMessageViewSet, basename='pooja-daily-messages')
router.register('donor-messages', DonorMessageTemplateViewSet, basename='pooja-donor-messages')
router.register('registrations', PoojaRegistrationViewSet, basename='pooja-registrations')
router.register('featured-poojas', FeaturedPoojaViewSet, basename='featured-poojas')

urlpatterns = [
    path('registrations/recent-public/', RecentPoojaRegistrationsView.as_view(), name='pooja-registrations-recent-public'),
    *router.urls,
]
