"""Routes for pooja domain."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CombinePaymentLookupView,
    DailyMessageViewSet,
    DonorMessageTemplateViewSet,
    FeaturedPoojaViewSet,
    PoojaCartSnapshotAssignView,
    PoojaCartSnapshotReportView,
    PoojaCartSnapshotView,
    PoojaDayOptionCalendarView,
    PoojaDonorCalendarView,
    PoojaDayOptionViewSet,
    UbhayamAllocationLatestView,
    UbhayamInputAllocateView,
    UbhayamInputMonthView,
    UbhayamInputSaveView,
    PoojaOptionViewSet,
    PoojaRegistrationViewSet,
    RecurringPoojaPlanViewSet,
    RecentPoojaRegistrationsView,
    SpecialAnnouncementViewSet,
    TamilNakshatraCalendarView,
    TodayPoojaRegistrationsPublicView,
)

router = DefaultRouter()
router.register('options', PoojaOptionViewSet, basename='pooja-options')
router.register('day-options', PoojaDayOptionViewSet, basename='pooja-day-options')
router.register('daily-messages', DailyMessageViewSet, basename='pooja-daily-messages')
router.register('special-announcements', SpecialAnnouncementViewSet, basename='pooja-special-announcements')
router.register('donor-messages', DonorMessageTemplateViewSet, basename='pooja-donor-messages')
router.register('registrations', PoojaRegistrationViewSet, basename='pooja-registrations')
router.register('recurrence/plans', RecurringPoojaPlanViewSet, basename='pooja-recurrence-plans')
router.register('featured-poojas', FeaturedPoojaViewSet, basename='featured-poojas')

urlpatterns = [
    path('cart-snapshots/assign/', PoojaCartSnapshotAssignView.as_view(), name='pooja-cart-snapshots-assign'),
    path('cart-snapshots/', PoojaCartSnapshotView.as_view(), name='pooja-cart-snapshots'),
    path('cart-snapshots/report/', PoojaCartSnapshotReportView.as_view(), name='pooja-cart-snapshots-report'),
    path('calendar/day-options/', PoojaDayOptionCalendarView.as_view(), name='pooja-calendar-day-options'),
    path(
        'calendar/donor-registrations/',
        PoojaDonorCalendarView.as_view(),
        name='pooja-calendar-donor-registrations',
    ),
    path('ubhayam-input/', UbhayamInputMonthView.as_view(), name='pooja-ubhayam-input-month'),
    path('ubhayam-input/save/', UbhayamInputSaveView.as_view(), name='pooja-ubhayam-input-save'),
    path('ubhayam-input/allocate/', UbhayamInputAllocateView.as_view(), name='pooja-ubhayam-input-allocate'),
    path('ubhayam-allocation/latest/', UbhayamAllocationLatestView.as_view(), name='pooja-ubhayam-allocation-latest'),
    path('calendar/tamil-nakshatras/', TamilNakshatraCalendarView.as_view(), name='pooja-calendar-tamil-nakshatras'),
    path('registrations/combine-lookup/', CombinePaymentLookupView.as_view(), name='pooja-registrations-combine-lookup'),
    path('registrations/recent-public/', RecentPoojaRegistrationsView.as_view(), name='pooja-registrations-recent-public'),
    path('registrations/today-public/', TodayPoojaRegistrationsPublicView.as_view(), name='pooja-registrations-today-public'),
    *router.urls,
]
