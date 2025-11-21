"""URL routes for accounts API."""

from django.urls import path

from .views import (
    DonorDetailView,
    DonorListView,
    DashboardMetricsView,
    FamilyMemberDetailView,
    FamilyMemberView,
    LoginView,
    PasswordResetView,
    ProfileView,
    RegisterView,
    RequestOtpView,
    VerifyOtpView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('request-otp/', RequestOtpView.as_view(), name='request-otp'),
    path('verify-otp/', VerifyOtpView.as_view(), name='verify-otp'),
    path('reset-password/', PasswordResetView.as_view(), name='reset-password'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('family-members/', FamilyMemberView.as_view(), name='family-members'),
    path('family-members/<int:pk>/', FamilyMemberDetailView.as_view(), name='family-member-detail'),
    path('donors/', DonorListView.as_view(), name='donor-list'),
    path('donors/<int:pk>/', DonorDetailView.as_view(), name='donor-detail'),
    path('dashboard-metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
]
