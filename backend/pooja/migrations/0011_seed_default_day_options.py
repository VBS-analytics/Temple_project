from django.db import migrations


DEFAULT_DAY_OPTIONS = [
    ("PRD", "Pradosham (Trayodashi)", "code"),
    ("CHRT", "Choose your preferred date", "code"),
    ("CS", "Choose your Tamil star", "code"),
    ("AD", "Any day of the month", "code"),
    ("FE", "1st day of the English month", "code"),
    ("FT", "1st day of the Tamil month", "code"),
    ("1TU", "1st Tuesday of the month", "code"),
    ("LSA", "Last Saturday of the month", "code"),
    ("SUN", "Every Sunday", "code"),
    ("SAS", "Sashti Tithi", "code"),
    ("AST", "Upcoming Ashtami day", "code"),
    ("PRM", "Pournami (Full moon)", "code"),
    ("AMV", "Amavasai (New moon)", "code"),
    ("SKT", "Sankata Chaturthi", "code"),
    ("CTR", "Chaturthi (Shukla)", "code"),
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
