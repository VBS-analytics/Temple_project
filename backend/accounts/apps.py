from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):  # pragma: no cover - registration side effect
        from . import signals  # noqa: F401
