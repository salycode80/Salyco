"""Send one real SMS through SMS.ir, to check a template actually works.

Everything else in the test suite mocks the gateway, which proves the wiring
but says nothing about whether SMS.ir accepts a given template — the two
failure modes that matter (template not approved, parameter names not matching
the template's #placeholders#) are only visible against the live API.

This spends one real SMS credit per run and sends to a real handset, so it is
a management command rather than anything reachable over HTTP.

    python manage.py send_test_sms --template order    --to 09121234567
    python manage.py send_test_sms --template welcome  --to 09121234567
    python manage.py send_test_sms --template warranty --to 09121234567
    python manage.py send_test_sms --template otp      --to 09121234567

Add --dry-run to print the exact payload without sending.
"""

from __future__ import annotations

import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from users.sms_service import get_sms_service

# name -> (settings key, parameters as the app sends them)
TEMPLATES = {
    "welcome": (
        "SMS_IR_TEMPLATE_WELCOME",
        {"PHONE": "09120000000", "NAME": "تست"},
    ),
    "warranty": (
        "SMS_IR_TEMPLATE_WARRANTY",
        # TIME is the parenthesised slot and now carries the mattress name, not
        # a clock time; DATE is Shamsi. See send_warranty_activated_sms().
        {
            "NAME": "تست",
            "TIME": "تشک طبی سالیکو",
            "DATE": "1405/05/09",
            "PHONE": "09120000000",
        },
    ),
    "order": (
        "SMS_IR_TEMPLATE_ORDER",
        # LINK is root-relative because the template supplies the origin, and it
        # must be a realistic 25 characters — the ceiling SMS.ir puts on a
        # parameter value. A longer sample here would fail the send and tell you
        # nothing about whether the real one works.
        {
            "ORDER_NUMBER": "123",
            "LINK": "orders/0123456789abcdefgh",
        },
    ),
    "otp": ("SMS_IR_TEMPLATE_ID", {"code": "1234"}),
}


class Command(BaseCommand):
    help = "Send one real SMS.ir message to verify a template is live and its parameters match."

    def add_arguments(self, parser):
        parser.add_argument(
            "--template",
            required=True,
            choices=sorted(TEMPLATES),
            help="Which template to exercise.",
        )
        parser.add_argument(
            "--to",
            required=True,
            help="Recipient, e.g. 09121234567. Use a handset you can read.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print the payload that would be sent, and stop.",
        )

    def handle(self, *args, **options):
        name = options["template"]
        setting_key, params = TEMPLATES[name]
        template_id = getattr(settings, setting_key, None)
        if not template_id:
            raise CommandError(f"{setting_key} is not configured in settings.")

        service = get_sms_service()
        payload = {
            "mobile": service._normalize_phone(options["to"]),
            "templateId": int(template_id),
            "parameters": [{"name": k, "value": str(v)} for k, v in params.items()],
        }

        self.stdout.write(f"template : {name} (id {template_id}, from {setting_key})")
        self.stdout.write("payload  : " + json.dumps(payload, ensure_ascii=False))

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("dry run — nothing sent."))
            return

        ok, message = service.send_template(options["to"], int(template_id), params)

        if ok:
            self.stdout.write(self.style.SUCCESS(f"sent OK — {message}"))
            self.stdout.write(
                "If no SMS arrives despite this, the template is approved but its "
                "#placeholders# likely differ from the parameter names above."
            )
        else:
            self.stdout.write(self.style.ERROR(f"FAILED — {message}"))
            self.stdout.write(
                "Common causes: template not approved in the SMS.ir panel, the id "
                "belongs to a different account than SMS_IR_API_KEY, or the "
                "parameter names do not match the template's #placeholders#."
            )
