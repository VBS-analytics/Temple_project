from django.apps import AppConfig


class PoojaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pooja'

    def ready(self):
        from . import signals
        signals.ready()
