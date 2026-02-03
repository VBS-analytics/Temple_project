from django.db import migrations


DROP_OLD = """
ALTER TABLE pooja_recurringpoojaplan
    DROP CONSTRAINT IF EXISTS pooja_recurring_unique;
"""

ADD_NEW = """
CREATE UNIQUE INDEX IF NOT EXISTS pooja_recurring_unique_null_one_time_date
    ON pooja_recurringpoojaplan (donor_id, pooja_option_id, day_option_id, recurrence_kind)
    WHERE recurrence_kind = 'recurring' AND one_time_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pooja_recurring_unique_with_one_time_date
    ON pooja_recurringpoojaplan (donor_id, pooja_option_id, day_option_id, recurrence_kind, one_time_date)
    WHERE recurrence_kind = 'recurring' AND one_time_date IS NOT NULL;
"""

REVERT = """
DROP INDEX IF EXISTS pooja_recurring_unique_null_one_time_date;
DROP INDEX IF EXISTS pooja_recurring_unique_with_one_time_date;

-- revert to the original single constraint (may fail if duplicates exist)
ALTER TABLE pooja_recurringpoojaplan
    ADD CONSTRAINT pooja_recurring_unique
        UNIQUE (donor_id, pooja_option_id, day_option_id, recurrence_kind);
"""


class Migration(migrations.Migration):

    dependencies = [
        ("pooja", "0017_add_due_registration_and_pause_from"),
    ]

    operations = [
        migrations.RunSQL(DROP_OLD),
        migrations.RunSQL(ADD_NEW, REVERT),
    ]
