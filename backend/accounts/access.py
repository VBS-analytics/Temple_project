"""Access helpers for account-specific capability rules."""

from __future__ import annotations

from collections.abc import Iterable

from .models import User, UserRole

READ_ONLY_ADMIN_PHONES = {
    "9999999998",
    "9999999997",
}

PAYMENT_STATEMENT_HIDDEN_ADMIN_PHONES = {
    "9999999997",
}

REPORT_DOWNLOAD_RESTRICTED_ADMIN_PHONES = {
    "9999999997",
}

REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE = (
    "You don't have access for downloading the reports, contact other admins."
)


def _phone_candidates(phone_number: str | None) -> set[str]:
    if not phone_number:
        return set()
    raw = str(phone_number).strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    candidates = {raw, digits}
    if digits and len(digits) > 10:
        candidates.add(digits[-10:])
    return {value for value in candidates if value}


def _matches_phone_set(phone_number: str | None, phone_set: Iterable[str]) -> bool:
    normalized_targets = {str(value).strip() for value in phone_set if str(value).strip()}
    if not normalized_targets:
        return False
    candidates = _phone_candidates(phone_number)
    return any(candidate in normalized_targets for candidate in candidates)


def is_read_only_admin(user: User | None) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.role == UserRole.ADMIN
        and _matches_phone_set(user.phone_number, READ_ONLY_ADMIN_PHONES)
    )


def can_view_payment_statement(user: User | None) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.role != UserRole.ADMIN:
        return True
    return not _matches_phone_set(user.phone_number, PAYMENT_STATEMENT_HIDDEN_ADMIN_PHONES)


def can_download_reports(user: User | None) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.role != UserRole.ADMIN:
        return False
    return not _matches_phone_set(user.phone_number, REPORT_DOWNLOAD_RESTRICTED_ADMIN_PHONES)
