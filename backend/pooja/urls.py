"""Routes for pooja domain."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CombinePaymentLookupView,
    DailyMessageViewSet,
    DonorMessageTemplateViewSet,
    FeaturedPoojaViewSet,
    PoojaCartSnapshotAssignView,
    PoojaCartSnapshotView,
    PoojaDayOptionViewSet,
    PoojaOptionViewSet,
    PoojaRegistrationViewSet,
    RecurringPoojaPlanViewSet,
    RecentPoojaRegistrationsView,
    TodayPoojaRegistrationsPublicView,
)

router = DefaultRouter()
router.register('options', PoojaOptionViewSet, basename='pooja-options')
router.register('day-options', PoojaDayOptionViewSet, basename='pooja-day-options')
router.register('daily-messages', DailyMessageViewSet, basename='pooja-daily-messages')
router.register('donor-messages', DonorMessageTemplateViewSet, basename='pooja-donor-messages')
router.register('registrations', PoojaRegistrationViewSet, basename='pooja-registrations')
router.register('recurrence/plans', RecurringPoojaPlanViewSet, basename='pooja-recurrence-plans')
router.register('featured-poojas', FeaturedPoojaViewSet, basename='featured-poojas')

urlpatterns = [
    path('cart-snapshots/assign/', PoojaCartSnapshotAssignView.as_view(), name='pooja-cart-snapshots-assign'),
    path('cart-snapshots/', PoojaCartSnapshotView.as_view(), name='pooja-cart-snapshots'),
    path('registrations/combine-lookup/', CombinePaymentLookupView.as_view(), name='pooja-registrations-combine-lookup'),
    path('registrations/recent-public/', RecentPoojaRegistrationsView.as_view(), name='pooja-registrations-recent-public'),
    path('registrations/today-public/', TodayPoojaRegistrationsPublicView.as_view(), name='pooja-registrations-today-public'),
    *router.urls,
]
