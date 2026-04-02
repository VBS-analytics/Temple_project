"""URL routes for accounts API."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DashboardMetricsView,
    DonorFeedbackView,
    DonorFeedbackExportView,
    DonorDetailView,
    DonorListView,
    FamilyMemberDetailView,
    FamilyMemberView,
    GothraOptionViewSet,
    LoginView,
    NakshatraOptionViewSet,
    PasswordResetView,
    ProfileView,
    RasiOptionViewSet,
    RegisterView,
    RequestOtpView,
    VerifyOtpView,
    BulkRegisterView,
)

router = DefaultRouter()
router.register('gothra-options', GothraOptionViewSet, basename='gothra-options')
router.register('nakshatra-options', NakshatraOptionViewSet, basename='nakshatra-options')
router.register('rasi-options', RasiOptionViewSet, basename='rasi-options')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('bulk-register/', BulkRegisterView.as_view(), name='bulk-register'),
    path('login/', LoginView.as_view(), name='login'),
    path('request-otp/', RequestOtpView.as_view(), name='request-otp'),
    path('verify-otp/', VerifyOtpView.as_view(), name='verify-otp'),
    path('reset-password/', PasswordResetView.as_view(), name='reset-password'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('donor-feedback/', DonorFeedbackView.as_view(), name='donor-feedback'),
    path('donor-feedback-export/', DonorFeedbackExportView.as_view(), name='donor-feedback-export'),
    path('family-members/', FamilyMemberView.as_view(), name='family-members'),
    path('family-members/<int:pk>/', FamilyMemberDetailView.as_view(), name='family-member-detail'),
    path('donors/', DonorListView.as_view(), name='donor-list'),
    path('donors/<int:pk>/', DonorDetailView.as_view(), name='donor-detail'),
    path('dashboard-metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
]

urlpatterns += router.urls
