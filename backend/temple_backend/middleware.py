"""Custom middleware for response handling."""

from __future__ import annotations

from typing import Callable

from django.http import HttpRequest, HttpResponse


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
