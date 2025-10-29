from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_donorprofile_donor_number'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='donorprofile',
                    name='gender',
                    field=models.CharField(blank=True, default='', max_length=32),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE accounts_donorprofile "
                        "ADD COLUMN IF NOT EXISTS gender varchar(32) NOT NULL DEFAULT '';"
                    ),
                    reverse_sql="ALTER TABLE accounts_donorprofile DROP COLUMN IF EXISTS gender;",
                ),
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE accounts_donorprofile "
                        "ALTER COLUMN gender SET DEFAULT '';"
                    ),
                    reverse_sql=(
                        "ALTER TABLE accounts_donorprofile "
                        "ALTER COLUMN gender DROP DEFAULT;"
                    ),
                ),
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE accounts_donorprofile "
                        "ALTER COLUMN gender SET NOT NULL;"
                    ),
                    reverse_sql=(
                        "ALTER TABLE accounts_donorprofile "
                        "ALTER COLUMN gender DROP NOT NULL;"
                    ),
                ),
            ],
        ),
    ]
