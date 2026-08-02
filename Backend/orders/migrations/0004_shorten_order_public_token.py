from django.db import migrations, models

import orders.models


def reissue_long_tokens(apps, schema_editor):
    """Re-issue any token that no longer fits the confirmation SMS.

    Orders created before this migration carry the original token_hex(16) value,
    32 characters long. "orders/" + 32 is 39, well past the 25-character ceiling
    SMS.ir puts on a pattern parameter, so those orders could never be notified
    — including via the admin-panel retry, which would fail forever.

    Rotating a token invalidates the public link in any SMS already sent for
    that order. That costs nothing here: the sends this affects are exactly the
    ones SMS.ir rejected, so no working link exists to break.
    """
    Order = apps.get_model("orders", "Order")
    # 25 - len("orders/") = 18.
    for pk in Order.objects.exclude(public_token__regex=r"^.{1,18}$").values_list(
        "pk", flat=True
    ):
        Order.objects.filter(pk=pk).update(
            public_token=orders.models.generate_order_token()
        )


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0003_order_public_token_and_confirmation_latch"),
    ]

    operations = [
        # No-op for the database (max_length is not enforced by SQLite and the
        # column is already wide enough), but it keeps the model and the
        # migration state in step now that the default callable has changed.
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
        migrations.RunPython(reissue_long_tokens, migrations.RunPython.noop),
    ]
