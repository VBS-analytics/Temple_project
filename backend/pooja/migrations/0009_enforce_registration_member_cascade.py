from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("pooja", "0008_add_tamil_nakshatra_day_options"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE pooja_poojaregistrationmember
            DROP CONSTRAINT IF EXISTS pooja_poojaregistrat_registration_id_d1f9293e_fk_pooja_poo;

            ALTER TABLE pooja_poojaregistrationmember
            ADD CONSTRAINT pooja_poojaregistrat_registration_id_d1f9293e_fk_pooja_poo
                FOREIGN KEY (registration_id)
                REFERENCES pooja_poojaregistration(id)
                ON DELETE CASCADE
                DEFERRABLE INITIALLY DEFERRED;
            """,
            reverse_sql="""
            ALTER TABLE pooja_poojaregistrationmember
            DROP CONSTRAINT IF EXISTS pooja_poojaregistrat_registration_id_d1f9293e_fk_pooja_poo;

            ALTER TABLE pooja_poojaregistrationmember
            ADD CONSTRAINT pooja_poojaregistrat_registration_id_d1f9293e_fk_pooja_poo
                FOREIGN KEY (registration_id)
                REFERENCES pooja_poojaregistration(id)
                ON DELETE NO ACTION
                DEFERRABLE INITIALLY DEFERRED;
            """,
        ),
    ]
