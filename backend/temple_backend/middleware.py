"""Custom middleware for response handling."""

from __future__ import annotations

from typing import Callable

from django.http import HttpRequest, HttpResponse, JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

from accounts.access import is_read_only_admin

class SilentJWTAuthentication(JWTAuthentication):
    """
    JWT authentication that gracefully handles missing/invalid tokens.
    
    Unlike the default JWTAuthentication, this class returns None (no user)
    for missing or invalid tokens instead of raising an exception. This allows
    permission_classes = [AllowAny] to work correctly on views like /api/auth/login/.
    
    When a valid JWT is provided, it authenticates normally. When no JWT or an
    invalid JWT is provided, it silently returns None, allowing the permission
    classes to decide access.
    """
    
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            # Silently fail; let permission classes handle access control
            return None


class NoCacheForAuthenticatedMiddleware:
    """
    Prevent browsers from caching responses that required auth.

    Firefox was persisting old API payloads for endpoints hit with Authorization
    headers, so we explicitly mark those responses as non-cacheable.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        auth_header = request.headers.get("Authorization")
        if auth_header:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


class ReadOnlyAdminWriteBlockMiddleware:
    """Block mutating API requests for restricted read-only admin accounts."""

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response
        self.jwt_auth = SilentJWTAuthentication()

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.path.startswith("/api/") and request.method.upper() not in self.SAFE_METHODS:
            auth_result = self.jwt_auth.authenticate(request)
            if auth_result is not None:
                user, _token = auth_result
                request.user = user
                if is_read_only_admin(user):
                    return JsonResponse(
                        {"detail": "This admin account has read-only access."},
                        status=403,
                    )
        return self.get_response(request)
