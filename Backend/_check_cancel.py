"""Throwaway end-to-end check of the public cancel endpoint."""
from django.test import Client

from orders.models import Order

c = Client()

for st in [Order.PENDING, Order.CONFIRMED, Order.SHIPPED, Order.CANCELLED]:
    o = Order.objects.filter(status=st).first()
    if o is None:
        o = Order.objects.exclude(status=st).first()
        if o is None:
            print(f"{st:10} : no orders in db, skipped")
            continue
        Order.objects.filter(pk=o.pk).update(status=st)
        o.refresh_from_db()

    before = o.status
    r = c.post(f"/api/orders/public/{o.public_token}/cancel/")
    o.refresh_from_db()
    detail = ""
    if r.status_code != 200:
        detail = " | " + str(r.json().get("detail", ""))[:60]
    print(f"{before:10} -> HTTP {r.status_code} | now {o.status}{detail}")

print()
r = c.post("/api/orders/public/definitelynotarealtoken/cancel/")
print("bad token  -> HTTP", r.status_code)

o = Order.objects.first()
r = c.get(f"/api/orders/public/{o.public_token}/")
print("GET detail -> HTTP", r.status_code, "| token leaked:", "public_token" in r.json())
