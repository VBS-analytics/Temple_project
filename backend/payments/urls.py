"""Payment routes."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AccountStatementExportView,
    AdditionIncomeRecordViewSet,
    CombinePaymentAccessView,
    CombinePaymentMappingView,
    DonationCreateView,
    ExpenseCategoryViewSet,
    ExpenseRecordViewSet,
    GeneralDonationExportView,
    IncomeCategoryViewSet,
    PaymentDetailsExportView,
    PaymentRecordViewSet,
    PassbookEntryViewSet,
)

router = DefaultRouter()
router.register('records', PaymentRecordViewSet, basename='payment-records')
router.register('expenses', ExpenseRecordViewSet, basename='expense-records')
router.register('addition-incomes', AdditionIncomeRecordViewSet, basename='addition-income-records')
router.register('expense-categories', ExpenseCategoryViewSet, basename='expense-categories')
router.register('income-categories', IncomeCategoryViewSet, basename='income-categories')
router.register('passbook-entries', PassbookEntryViewSet, basename='passbook-entries')

urlpatterns = router.urls
urlpatterns += [
    path('donations/', DonationCreateView.as_view(), name='donation-create'),
    path('combine-mappings/', CombinePaymentMappingView.as_view(), name='combine-payment-mappings'),
    path('combine-access/', CombinePaymentAccessView.as_view(), name='combine-payment-access'),
    path('payment-details-export/', PaymentDetailsExportView.as_view(), name='payment-details-export'),
    path('general-donation-export/', GeneralDonationExportView.as_view(), name='general-donation-export'),
    path('account-statement-export/', AccountStatementExportView.as_view(), name='account-statement-export'),
]
