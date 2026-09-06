"""Settle payments whose callback never arrived.

This command is the half of the payment guarantee that the callback cannot
provide. The callback runs in the customer's browser; if it is lost to a deploy,
a container restart, a closed laptop or a network blip, a real customer has been
charged and our side still shows an unpaid order. Nothing else in the system
would ever notice, so without this command "transactional" would be a claim
rather than a property.

Run it on a schedule — every 15 minutes is ample:

    */15 * * * * cd /app && python manage.py reconcile_payments

Safe to run concurrently with a live callback and safe to run twice: both paths
settle through payments.settlement, which locks the row and checks the
verified_at latch before doing anything.

/v1/inquiry is used to read state because, unlike /v1/verify, it changes
nothing — so a payment the customer is still working on is not disturbed by
being looked at.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from payments import settlement, zibal
from payments.models import Payment

logger = logging.getLogger(__name__)

# Statuses that mean "we do not yet know how this ended". Anything else is
# already terminal and must never be revisited.
UNSETTLED_STATUSES = (Payment.REDIRECTED, Payment.PAID_UNVERIFIED)

DEFAULT_MINUTES = 30


class Command(BaseCommand):
    help = "Settle Zibal payments whose callback never arrived."

    def add_arguments(self, parser):
        parser.add_argument(
            "--minutes",
            type=int,
            default=DEFAULT_MINUTES,
            help=(
                "Only consider payments older than this many minutes. The delay "
                "avoids racing a customer who is still on the bank page "
                f"(default: {DEFAULT_MINUTES})."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be settled without writing anything.",
        )

    def handle(self, *args, **options):
        minutes = options["minutes"]
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timedelta(minutes=minutes)

        payments = (
            Payment.objects.select_related("order")
            .filter(
                status__in=UNSETTLED_STATUSES,
                verified_at__isnull=True,
                track_id__isnull=False,
                created_at__lt=cutoff,
            )
            .order_by("created_at")
        )

        self.stdout.write(
            f"Reconciling {payments.count()} payment(s) older than {minutes} minute(s)"
            + (" [dry run]" if dry_run else "")
        )

        for payment in payments:
            try:
                self._reconcile(payment, dry_run=dry_run)
            except Exception:
                # One unreconcilable payment must not strand the rest — the next
                # one in the queue may be a customer waiting on a confirmed order.
                logger.exception(
                    "Reconciliation failed for payment %s (trackId %s)",
                    payment.pk,
                    payment.track_id,
                )
                self.stderr.write(
                    f"  trackId {payment.track_id}: error, skipped (see logs)"
                )

    def _reconcile(self, payment: Payment, *, dry_run: bool) -> None:
        ok, data = zibal.inquiry(payment.track_id)
        if not ok:
            # Leave it exactly as it is; the next run tries again.
            self.stdout.write(f"  trackId {payment.track_id}: gateway unreachable")
            return

        zibal_status = data.get("status")

        if dry_run:
            self.stdout.write(
                f"  trackId {payment.track_id}: Zibal status {zibal_status} "
                f"({zibal.status_message(zibal_status)}) — would settle"
            )
            return

        if zibal_status == zibal.STATUS_PAID_UNVERIFIED:
            # Money is captured but the session was never closed. Verifying is
            # what actually claims it, so go through verify rather than applying
            # the inquiry body directly.
            outcome, message = settlement.verify_and_settle(payment)
        else:
            # Everything else is applied from the inquiry body, which
            # settle_from_status reads status-first — an inquiry's result 100
            # means "report produced", not "payment succeeded".
            outcome, message = settlement.settle_from_status(payment, data)

        self.stdout.write(
            f"  trackId {payment.track_id}: Zibal status {zibal_status} → {outcome}"
            + (f" ({message})" if message else "")
        )
