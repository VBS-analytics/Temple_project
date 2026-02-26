from django.db import migrations


DEFAULT_DAY_OPTIONS = [
    ("CHRT", "Choose your preferred date", "code"),
    ("CS", "Choose your Tamil star", "code"),
    ("AD", "Any Day of Month", "code"),
    ("FE", "1st day of English Month", "code"),
    ("FT", "1st day of Tamil Month", "code"),
    ("1TU", "1st Tuesday of month", "code"),
    ("LSAT", "Last sat day of month", "code"),
    ("S", "Every Sunday", "code"),
    ("SH", "On sashti day of month", "code"),
    ("AST", "On 2 ashtami day of month", "code"),
    ("P", "On paurnami day of month", "code"),
    ("AMV", "On amavasai day of month", "code"),
    ("SC", "On sankatachaturti day of month", "code"),
    ("C", "On chaturti day of month", "code"),
    ("PRD", "Pradosham (Trayodashi)", "code"),
]


def create_default_day_options(apps, schema_editor):
    PoojaDayOption = apps.get_model("pooja", "PoojaDayOption")
    for index, (code, description, category) in enumerate(DEFAULT_DAY_OPTIONS, start=1):
        PoojaDayOption.objects.get_or_create(
            code=code,
            defaults={
                "description": description,
                "category": category,
                "display_order": index,
            },
        )


def remove_default_day_options(apps, schema_editor):
    PoojaDayOption = apps.get_model("pooja", "PoojaDayOption")
    codes = [code for code, *_ in DEFAULT_DAY_OPTIONS]
    PoojaDayOption.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("pooja", "0010_specialannouncement"),
    ]

    operations = [
        migrations.RunPython(
            create_default_day_options,
            remove_default_day_options,
        ),
    ]
