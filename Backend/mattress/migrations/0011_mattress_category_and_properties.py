import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    """Turn Mattress into the backing table for every product line.

    Pure AddField — `category` defaults to "mattress", so every row already in
    the table stays a mattress and no data migration is needed. The four
    property fields are all optional/zero-valued for the same reason.
    """

    dependencies = [
        ('mattress', '0010_alter_mattress_average_rating_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='mattress',
            name='category',
            field=models.CharField(
                choices=[
                    ('mattress', 'تشک'),
                    ('bedbox', 'باکس تخت خواب'),
                    ('pillow', 'بالش'),
                    ('duvet', 'روتختی'),
                    ('topper', 'محافظ تشک و تاپر'),
                ],
                db_index=True,
                default='mattress',
                max_length=20,
                verbose_name='category',
            ),
        ),
        migrations.AddField(
            model_name='mattress',
            name='firmness',
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text='۱ = بسیار نرم، ۱۰ = بسیار سخت. Leave empty to hide the scale.',
                null=True,
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(10),
                ],
                verbose_name='firmness (1-10)',
            ),
        ),
        migrations.AddField(
            model_name='mattress',
            name='material',
            field=models.CharField(
                blank=True,
                default='',
                help_text='e.g. مموری فوم، الیاف میکروفایبر',
                max_length=120,
                verbose_name='material',
            ),
        ),
        migrations.AddField(
            model_name='mattress',
            name='is_washable',
            field=models.BooleanField(default=False, verbose_name='washable'),
        ),
        migrations.AddField(
            model_name='mattress',
            name='trial_nights',
            field=models.PositiveIntegerField(
                default=0,
                help_text='0 hides the trial badge.',
                verbose_name='trial nights',
            ),
        ),
    ]
