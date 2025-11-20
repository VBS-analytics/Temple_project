from django.db import migrations, models


def add_pradosham_day_option(apps, schema_editor):
    PoojaDayOption = apps.get_model("pooja", "PoojaDayOption")
    if PoojaDayOption.objects.filter(code__iexact="PRD").exists():
        return
    max_order = PoojaDayOption.objects.aggregate(models.Max("display_order")).get("display_order__max") or 0
    PoojaDayOption.objects.create(
        code="PRD",
        description="Pradosham (Trayodashi)",
        category="code",
        display_order=max_order + 1,
    )


def remove_pradosham_day_option(apps, schema_editor):
    PoojaDayOption = apps.get_model("pooja", "PoojaDayOption")
    PoojaDayOption.objects.filter(code__iexact="PRD").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("pooja", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(add_pradosham_day_option, remove_pradosham_day_option),
    ]
