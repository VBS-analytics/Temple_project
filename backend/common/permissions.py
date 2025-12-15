"""Shared permission classes used across multiple apps."""

from rest_framework import permissions

from accounts.models import UserRole


class IsAdminRole(permissions.BasePermission):
    """Only allow admins to access the view."""

    def has_permission(self, request, view):  # pragma: no cover - simple predicate
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.ADMIN)


class ReadOnlyOrAdmin(permissions.BasePermission):
    """Allow safe methods for authenticated users, restrict writes to admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.ADMIN)
