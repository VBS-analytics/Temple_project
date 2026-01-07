"""Utility views for the Temple backend."""

from django.http import JsonResponse
from django.utils import timezone


def health_check(request):
    """Simple lightweight endpoint used by external keep-alive probes."""
    return JsonResponse(
        {
            "status": "ok",
            "timestamp": timezone.now().isoformat(),
        }
    )
