from django.db import migrations


SQL = """
DROP INDEX IF EXISTS pooja_recurring_unique;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("pooja", "0019_drop_legacy_recurring_unique"),
    ]

    operations = [
        migrations.RunSQL(SQL, migrations.RunSQL.noop),
    ]
