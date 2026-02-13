"""Shared permission classes used across multiple apps."""

from rest_framework import permissions

from accounts.access import is_read_only_admin
from accounts.models import UserRole


class IsAdminRole(permissions.BasePermission):
    """Only allow admins to access the view."""

    def has_permission(self, request, view):  # pragma: no cover - simple predicate
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role != UserRole.ADMIN:
            return False
        if request.method not in permissions.SAFE_METHODS and is_read_only_admin(request.user):
            return False
        return True


class ReadOnlyOrAdmin(permissions.BasePermission):
    """Allow safe methods for authenticated users, restrict writes to admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.ADMIN
            and not is_read_only_admin(request.user)
        )
