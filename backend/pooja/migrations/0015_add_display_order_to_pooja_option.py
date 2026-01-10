"""Add an explicit display order for pooja options."""

from django.db import migrations, models


def assign_display_order(apps, schema_editor):
    PoojaOption = apps.get_model("pooja", "PoojaOption")
    parent_ids = set(PoojaOption.objects.values_list("parent_id", flat=True))
    for parent_id in parent_ids:
        siblings = list(
            PoojaOption.objects.filter(parent_id=parent_id).order_by("code")
        )
        for position, option in enumerate(siblings, start=1):
            PoojaOption.objects.filter(pk=option.pk).update(display_order=position)


class Migration(migrations.Migration):

    dependencies = [
        ("pooja", "0014_poojacartsnapshotexportbatch_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="poojaoption",
            name="display_order",
            field=models.PositiveIntegerField(default=0, db_index=True),
        ),
        migrations.RunPython(assign_display_order, migrations.RunPython.noop),
        migrations.AlterModelOptions(
            name="poojaoption",
            options={"ordering": ("parent_id", "display_order", "code")},
        ),
    ]
