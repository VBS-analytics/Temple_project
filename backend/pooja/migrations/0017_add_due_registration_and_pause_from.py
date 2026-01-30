# Generated migration to add due_registration field to RecurringPoojaPlan

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pooja', '0016_seed_pooja_catalogue'),
    ]

    operations = [
        migrations.AddField(
            model_name='recurringpoojaplan',
            name='due_registration',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='due_recurring_plans',
                help_text="Auto-created registration for the next scheduled occurrence of this plan",
                to='pooja.poojaregistration'
            ),
        ),
    ]
