from django.db import migrations, models

import orders.models


def backfill_tokens(apps, schema_editor):
    """Give each pre-existing order its own token.

    AddField evaluates a callable default ONCE and writes that single value to
    every existing row, so the field is added non-unique, filled in per-row
    here, and only then constrained. Rows created after this migration get
    their token from the field default.
    """
    Order = apps.get_model("orders", "Order")
    for pk in Order.objects.values_list("pk", flat=True):
        Order.objects.filter(pk=pk).update(
            public_token=orders.models.generate_order_token()
        )


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0002_order_call_time_preference_order_customer_phone"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="confirmation_sms_sent_at",
            field=models.DateTimeField(
                blank=True,
                editable=False,
                null=True,
                verbose_name="confirmation SMS sent at",
            ),
        ),
        # Step 1: add it nullable and unconstrained.
        migrations.AddField(
            model_name="order",
            name="public_token",
            field=models.CharField(
                default="",
                editable=False,
                max_length=64,
                verbose_name="public token",
            ),
            preserve_default=False,
        ),
        # Step 2: one distinct token per existing row.
        migrations.RunPython(backfill_tokens, migrations.RunPython.noop),
        # Step 3: now that all values differ, apply the real definition.
        migrations.AlterField(
            model_name="order",
            name="public_token",
            field=models.CharField(
                default=orders.models.generate_order_token,
                editable=False,
                max_length=64,
                unique=True,
                verbose_name="public token",
            ),
        ),
    ]
