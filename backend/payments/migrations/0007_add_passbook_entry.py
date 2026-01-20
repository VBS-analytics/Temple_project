# Generated migration for PassbookEntry model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0006_alter_combinepaymentmapping_effective_from'),
    ]

    operations = [
        migrations.CreateModel(
            name='PassbookEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entry_date', models.DateField(help_text='Date of the transaction/entry (e.g., 31/12/2025 for opening balance)')),
                ('entry_type', models.CharField(choices=[('balance', 'Opening Balance'), ('due', 'Pooja Due'), ('paid', 'Payment Received')], max_length=10)),
                ('transaction_details', models.CharField(blank=True, help_text="e.g., transaction ID or 'Pooja DUE'", max_length=255)),
                ('opening_balance', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('due_amount', models.DecimalField(decimal_places=2, default=0, help_text='Due for current month', max_digits=12)),
                ('paid_amount', models.DecimalField(decimal_places=2, default=0, help_text='Amount received', max_digits=12)),
                ('closing_due', models.DecimalField(decimal_places=2, default=0, help_text='Closing due for current month', max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('donor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='passbook_entries', to=settings.AUTH_USER_MODEL)),
                ('payment_record', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='passbook_entries', to='payments.paymentrecord')),
                ('registration', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='passbook_entries', to='pooja.poojaregistration')),
            ],
            options={
                'ordering': ('donor', 'entry_date'),
            },
        ),
        migrations.AddIndex(
            model_name='passbookentry',
            index=models.Index(fields=['donor', 'entry_date'], name='payments_pas_donor_i_idx'),
        ),
        migrations.AddIndex(
            model_name='passbookentry',
            index=models.Index(fields=['donor', '-entry_date'], name='payments_pas_donor_i2_idx'),
        ),
    ]
