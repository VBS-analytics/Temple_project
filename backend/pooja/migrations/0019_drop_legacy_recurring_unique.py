from django.db import migrations


SQL = """
ALTER TABLE pooja_recurringpoojaplan
    DROP CONSTRAINT IF EXISTS pooja_recurring_unique;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("pooja", "0018_split_recurring_unique"),
    ]

    operations = [
        migrations.RunSQL(SQL, migrations.RunSQL.noop),
    ]
