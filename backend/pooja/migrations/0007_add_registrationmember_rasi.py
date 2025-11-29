from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('pooja', '0006_recurringpoojaplan_pause_from'),
    ]

    operations = [
        migrations.AddField(
            model_name='poojaregistrationmember',
            name='rasi',
            field=models.CharField(blank=True, default='', max_length=128),
        ),
    ]
