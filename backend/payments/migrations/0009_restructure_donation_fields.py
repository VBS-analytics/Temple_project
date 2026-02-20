from django.db import migrations, models


def _populate_donor_identity(apps, schema_editor):
    Donation = apps.get_model('payments', 'Donation')
    for donation in Donation.objects.select_related('donor').all().iterator():
        donor = getattr(donation, 'donor', None)
        donor_name = getattr(donor, 'name', '') if donor is not None else ''
        donor_phone = getattr(donor, 'phone_number', '') if donor is not None else ''
        donation.donor_name = donor_name or ''
        donation.donor_phone_no = donor_phone or ''
        donation.save(update_fields=['donor_name', 'donor_phone_no'])


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0008_donation_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='donation',
            name='donor_name',
            field=models.CharField(default='', max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='donation',
            name='donor_phone_no',
            field=models.CharField(default='', max_length=20),
            preserve_default=False,
        ),
        migrations.RenameField(
            model_name='donation',
            old_name='amount',
            new_name='amount_paid',
        ),
        migrations.RenameField(
            model_name='donation',
            old_name='transaction_reference',
            new_name='transaction_id',
        ),
        migrations.AlterField(
            model_name='donation',
            name='transaction_id',
            field=models.CharField(max_length=255),
        ),
        migrations.RunPython(_populate_donor_identity, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='donation',
            name='donor',
        ),
        migrations.RemoveField(
            model_name='donation',
            name='currency',
        ),
        migrations.RemoveField(
            model_name='donation',
            name='mode',
        ),
        migrations.RemoveField(
            model_name='donation',
            name='created_at',
        ),
        migrations.RemoveField(
            model_name='donation',
            name='updated_at',
        ),
        migrations.AlterField(
            model_name='donation',
            name='donation_date',
            field=models.DateField(),
        ),
        migrations.AlterModelOptions(
            name='donation',
            options={'db_table': 'donation', 'ordering': ('-donation_date', '-id')},
        ),
    ]
