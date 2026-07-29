from __future__ import annotations

import datetime

import django.utils.timezone
from django.db import migrations, models


def seed_created_at(apps, schema_editor):
    """Derive created_at for pre-existing instances from manufacture_date.

    AddField stamps every existing row with the migration's own timestamp,
    which would leave the whole back catalogue tied and sorting arbitrarily.
    manufacture_date is the closest record of when an instance came into
    existence, so use it (at midnight UTC) instead.

    .update() rather than .save(): auto_now_add=True would overwrite the value
    on save and undo the backfill.
    """
    MattressInstance = apps.get_model("mattress", "MattressInstance")
    for instance in MattressInstance.objects.all().iterator():
        if not instance.manufacture_date:
            continue
        stamp = datetime.datetime.combine(
            instance.manufacture_date,
            datetime.time.min,
            tzinfo=datetime.timezone.utc,
        )
        MattressInstance.objects.filter(pk=instance.pk).update(created_at=stamp)


def unseed(apps, schema_editor):
    """Nothing to undo — the column is dropped by reversing AddField."""


class Migration(migrations.Migration):

    dependencies = [
        ("mattress", "0008_mattress_is_on_off_mattress_off_percentage"),
    ]

    operations = [
        migrations.AddField(
            model_name="mattressinstance",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True,
                db_index=True,
                default=django.utils.timezone.now,
                verbose_name="created at",
            ),
            preserve_default=False,
        ),
        migrations.AlterModelOptions(
            name="mattressinstance",
            options={
                "ordering": ["-created_at", "serial_number"],
                "verbose_name": "mattress instance",
                "verbose_name_plural": "mattress instances",
            },
        ),
        migrations.RunPython(seed_created_at, unseed),
    ]
