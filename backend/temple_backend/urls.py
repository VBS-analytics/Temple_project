"""Root URL configuration for the Temple backend API."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/pooja/', include('pooja.urls')),
    path('api/payments/', include('payments.urls')),
]

if settings.MEDIA_URL and settings.MEDIA_ROOT:
    media_prefix = settings.MEDIA_URL.lstrip('/')
    urlpatterns += [
        re_path(rf'^{media_prefix}(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT, 'show_indexes': False}),
    ]
