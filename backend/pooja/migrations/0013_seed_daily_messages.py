from django.db import migrations


DAILY_HEADER_TEXT = [
    (
        "Sunday",
        "ஞாயிறு  கிழமை -அபிஷேகம், * ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், *அய்யனார் கோவில்,  * பெருமாள் கோவில்",
    ),
    (
        "Monday",
        "திங்கட் கிழமை கிழமை அர்சனை  -* ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், * அய்யனார் கோவில், * பெருமாள் கோவில்",
    ),
    (
        "Tuesday",
        "செவ்வாய்  கிழமை -அபிஷேகம், * ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், *அய்யனார் கோவில், * பெருமாள் கோவில்",
    ),
    (
        "Wednesday",
        "கிழம அர்சனை  -* ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், * அய்யனார் கோவில், * பெருமாள் கோவில்",
    ),
    (
        "Thursday",
        "வியாழன் கிழமை அர்சனை  -* ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், * அய்யனார் கோவில், * பெருமாள் கோவில்",
    ),
    (
        "Friday",
        "வெள்ளி  கிழமை -அபிஷேகம், * ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பள், *அய்யனார் கோவில், * பெருமாள் கோவில்",
    ),
    (
        "Saturday",
        "சனி கிழமை அர்சனை  -* ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், * அய்யனார் கோவில், * பெருமாள் கோவில் + நவக்ரக அபிஷேகம் / அர்சனை",
    ),
]


def create_daily_messages(apps, schema_editor):
    DailyMessage = apps.get_model("pooja", "DailyMessage")
    for label, header_text in DAILY_HEADER_TEXT:
        DailyMessage.objects.update_or_create(
            label=label,
            defaults={"header_text": header_text, "footer_text": ""},
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("pooja", "0012_update_day_option_descriptions"),
    ]

    operations = [
        migrations.RunPython(create_daily_messages, noop),
    ]
