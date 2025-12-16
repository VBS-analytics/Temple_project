from django.db import migrations


NAKSHATRA_DAY_OPTIONS = [
    ("STR1", "அசுவினி"),
    ("STR2", "பரணி"),
    ("STR3", "கிருத்திகை"),
    ("STR4", "ரோகிணி"),
    ("STR5", "மிருகசீரிடம்"),
    ("STR6", "திருவாதிரை"),
    ("STR7", "புனர்பூசம்"),
    ("STR8", "பூசம்"),
    ("STR9", "ஆயில்யம்"),
    ("STR10", "மகம்"),
    ("STR11", "பூரம்"),
    ("STR12", "உத்தரம்"),
    ("STR13", "அஸ்தம்"),
    ("STR14", "சித்திரை"),
    ("STR15", "சுவாதி"),
    ("STR16", "விசாகம்"),
    ("STR17", "அனுஷம்"),
    ("STR18", "கேட்டை"),
    ("STR19", "மூலம்"),
    ("STR20", "பூராடம்"),
    ("STR21", "உத்திராடம்"),
    ("STR22", "திருவோணம்"),
    ("STR23", "அவிட்டம்"),
    ("STR24", "சதயம்"),
    ("STR25", "பூரட்டாதி"),
    ("STR26", "உத்திரட்டாதி"),
    ("STR27", "ரேவதி"),
]


def create_tamil_nakshatra_day_options(apps, schema_editor):
    PoojaDayOption = apps.get_model("pooja", "PoojaDayOption")
    for index, (code, description) in enumerate(NAKSHATRA_DAY_OPTIONS, start=1):
        PoojaDayOption.objects.update_or_create(
            code=code,
            defaults={
                "description": description,
                "category": "tamil_star",
                "display_order": index,
            },
        )


def remove_tamil_nakshatra_day_options(apps, schema_editor):
    PoojaDayOption = apps.get_model("pooja", "PoojaDayOption")
    codes = [code for code, _ in NAKSHATRA_DAY_OPTIONS]
    PoojaDayOption.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("pooja", "0007_add_registrationmember_rasi"),
    ]

    operations = [
        migrations.RunPython(
            create_tamil_nakshatra_day_options,
            remove_tamil_nakshatra_day_options,
        ),
    ]
