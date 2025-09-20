"""Root URL configuration for the Temple backend API."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/pooja/', include('pooja.urls')),
    path('api/payments/', include('payments.urls')),
]
