# Zibal Payment Gateway - Production Deployment Guide

این راهنما مراحل استقرار درگاه پرداخت زیبال در محیط تولید را شرح می‌دهد.

## پیش‌نیازها

1. **حساب زیبال تأییدشده**
   - ثبت‌نام در [gateway.zibal.ir](https://gateway.zibal.ir)
   - تکمیل احراز هویت و دریافت کد پذیرنده (merchant)
   - دریافت تأیید فعال‌سازی درگاه پرداخت

2. **دامنه HTTPS عمومی**
   - دامنه باید از طریق HTTPS در دسترس باشد (الزام زیبال)
   - گواهی SSL معتبر
   - دامنه باید در زیبال ثبت و تأیید شود

3. **دسترسی SSH به سرور**
   - Backend: Django application server
   - Frontend: Static file server (nginx/Caddy)
   - Database: PostgreSQL (توصیه‌شده برای production)

## مراحل استقرار

### 1. Backend Configuration

#### 1.1 Environment Variables

در فایل `.env` سرور production یا در تنظیمات محیط:

```bash
# Zibal Configuration
ZIBAL_MERCHANT=your_actual_merchant_code_here
ZIBAL_CALLBACK_BASE_URL=https://salyco.ir

# Frontend URL (for redirects after payment)
FRONTEND_BASE_URL=https://salyco.ir

# Database (توصیه: PostgreSQL برای قفل select_for_update)
DATABASE_URL=postgresql://user:password@localhost/dbname

# Django Settings
DEBUG=False
ALLOWED_HOSTS=salyco.ir,www.salyco.ir
SECRET_KEY=your_production_secret_key_here
```

**نکات مهم:**
- `ZIBAL_MERCHANT`: کد پذیرنده واقعی از پنل زیبال (جایگزین `zibal` شود)
- `ZIBAL_CALLBACK_BASE_URL`: باید با دامنه ثبت‌شده در زیبال مطابقت داشته باشد
- هرگز از `zibal` (حساب تست) در production استفاده نکنید

#### 1.2 Database Migration

```bash
# On production server
cd /path/to/salyco-backend
source env/bin/activate
python manage.py migrate payments
python manage.py migrate
```

بررسی موفقیت‌آمیز بودن:
```bash
python manage.py showmigrations payments
```

باید ببینید:
```
payments
 [X] 0001_initial
```

#### 1.3 Static Files

```bash
python manage.py collectstatic --no-input
```

#### 1.4 Test Zibal Connection

قبل از راه‌اندازی کامل، اتصال به زیبال را تست کنید:

```bash
python manage.py shell
```

```python
from payments import zibal
from django.conf import settings

# Check merchant is not test account
print(f"Merchant: {settings.ZIBAL_MERCHANT}")
assert settings.ZIBAL_MERCHANT != "zibal", "Still using test merchant!"

# Test connection (amount must be > 1000 Rial)
ok, data = zibal.request_payment(
    amount_rial=10000,
    callback_url="https://salyco.ir/api/payments/callback/",
    order_id="test-123"
)
print(f"OK: {ok}, Result: {data.get('result')}, TrackId: {data.get('trackId')}")

# Expected: ok=True, result=100, trackId=some_number
# If result=102: merchant authentication failed
# If result=106: callback URL rejected (not HTTPS or not registered)
```

#### 1.5 Restart Application

```bash
# Gunicorn/uWSGI restart (adjust for your setup)
sudo systemctl restart salyco-backend

# Or with supervisor
supervisorctl restart salyco-backend

# Or with Docker
docker-compose restart backend
```

### 2. Frontend Deployment

#### 2.1 Update API Base URL

بررسی کنید که frontend به آدرس صحیح backend متصل است:

**Frontend/salyco-front/src/api.js** یا **config**:
```javascript
const api = axios.create({
  baseURL: 'https://salyco.ir',  // Production backend
  // ...
});
```

#### 2.2 Build Frontend

```bash
cd Frontend/salyco-front
npm run build
```

#### 2.3 Deploy Built Files

```bash
# Copy build to server
rsync -avz --delete dist/ user@server:/var/www/salyco.ir/html/

# Or via Docker
docker-compose build frontend
docker-compose up -d frontend
```

#### 2.4 Verify Routes

اطمینان حاصل کنید که این route‌ها در دسترس هستند:
- `https://salyco.ir/checkout` → CheckoutOrder page
- `https://salyco.ir/payment/result` → PaymentResult page
- `https://salyco.ir/cart` → CartPage

### 3. Web Server Configuration (nginx/Caddy)

#### 3.1 nginx Configuration

```nginx
# /etc/nginx/sites-available/salyco.ir

upstream backend {
    server 127.0.0.1:8000;  # Django/Gunicorn
}

server {
    listen 443 ssl http2;
    server_name salyco.ir www.salyco.ir;
    
    ssl_certificate /etc/letsencrypt/live/salyco.ir/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/salyco.ir/privkey.pem;
    
    # Frontend static files
    root /var/www/salyco.ir/html;
    index index.html;
    
    # API requests → Django
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important: preserve full URL for Zibal callback
        proxy_redirect off;
    }
    
    # Admin panel → Django
    location /admin/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files (Django)
    location /static/ {
        alias /path/to/salyco-backend/staticfiles/;
    }
    
    # Media files
    location /media/ {
        alias /path/to/salyco-backend/media/;
    }
    
    # Frontend SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name salyco.ir www.salyco.ir;
    return 301 https://$server_name$request_uri;
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 3.2 Caddy Configuration (Alternative)

```caddyfile
# Caddyfile

salyco.ir {
    # Frontend
    root * /var/www/salyco.ir/html
    
    # API requests → Django
    handle /api/* {
        reverse_proxy localhost:8000
    }
    
    handle /admin/* {
        reverse_proxy localhost:8000
    }
    
    handle /static/* {
        reverse_proxy localhost:8000
    }
    
    handle /media/* {
        reverse_proxy localhost:8000
    }
    
    # SPA fallback
    try_files {path} /index.html
    file_server
}
```

### 4. Zibal Panel Configuration

1. **ورود به پنل زیبال**
   - رفتن به [gateway.zibal.ir](https://gateway.zibal.ir)
   - ورود با حساب کاربری تأییدشده

2. **ثبت Callback URL**
   - بخش تنظیمات → آدرس بازگشت (Callback URL)
   - افزودن: `https://salyco.ir/api/payments/callback/`
   - ذخیره و تأیید

3. **بررسی وضعیت درگاه**
   - اطمینان از فعال بودن درگاه پرداخت
   - بررسی محدودیت مبلغ (اگر وجود دارد)
   - تأیید تعرفه و کارمزد

4. **تنظیمات IP Whitelist (اختیاری)**
   - اگر زیبال whitelist فعال دارید، IP سرور را اضافه کنید

### 5. Reconciliation Cron Job

برای پردازش پرداخت‌های lost callback، یک cron job تنظیم کنید:

```bash
# On production server
crontab -e
```

```cron
# Run reconciliation every 30 minutes
*/30 * * * * /path/to/salyco-backend/env/bin/python /path/to/salyco-backend/manage.py reconcile_payments --minutes 30 >> /var/log/salyco/reconcile.log 2>&1

# Or more conservatively, every hour
0 * * * * /path/to/salyco-backend/env/bin/python /path/to/salyco-backend/manage.py reconcile_payments --minutes 60 >> /var/log/salyco/reconcile.log 2>&1
```

بررسی عملکرد:
```bash
# Test manually first
cd /path/to/salyco-backend
source env/bin/activate
python manage.py reconcile_payments --dry-run --minutes 30
```

### 6. Monitoring & Logging

#### 6.1 Log Files

مسیرهای log مهم:
```bash
# Django application logs
/var/log/salyco/backend.log

# Reconciliation command logs
/var/log/salyco/reconcile.log

# nginx access/error logs
/var/log/nginx/salyco-access.log
/var/log/nginx/salyco-error.log
```

#### 6.2 Important Log Patterns to Monitor

```bash
# Payment failures
grep "Zibal refused payment" /var/log/salyco/backend.log

# Amount mismatches (critical!)
grep "amount mismatch" /var/log/salyco/backend.log

# Refunds (critical!)
grep "refunded/reversed" /var/log/salyco/backend.log

# Reconciliation activity
grep "Reconciling" /var/log/salyco/reconcile.log
```

#### 6.3 Database Queries for Monitoring

```sql
-- Pending payments older than 1 hour
SELECT id, track_id, amount_rial, status, created_at 
FROM payments_payment 
WHERE status IN ('REDIRECTED', 'PAID_UNVERIFIED') 
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at;

-- Failed payments today
SELECT COUNT(*), failure_reason 
FROM payments_payment 
WHERE status = 'FAILED' 
  AND created_at >= CURRENT_DATE
GROUP BY failure_reason;

-- Orders awaiting confirmation
SELECT o.id, o.created_at, o.total_amount, p.status
FROM orders_order o
LEFT JOIN payments_payment p ON p.order_id = o.id
WHERE o.method = 'ONLINE' 
  AND o.status = 'PENDING'
  AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY o.created_at DESC;
```

### 7. Testing in Production

**⚠️ هشدار: تست با مبالغ واقعی هزینه دارد!**

#### 7.1 Initial Test Transaction

1. یک تراکنش کوچک واقعی انجام دهید (مثلاً 10,000 تومان)
2. کل flow را دنبال کنید:
   - افزودن محصول به سبد خرید
   - رفتن به صفحه checkout
   - کلیک روی دکمه "پرداخت آنلاین"
   - انتقال به درگاه زیبال
   - پرداخت با کارت واقعی
   - بازگشت به سایت
   - بررسی وضعیت سفارش

3. بررسی‌های مورد نیاز:
   ```bash
   # Check payment record
   python manage.py shell
   ```
   ```python
   from payments.models import Payment
   from orders.models import Order
   
   # Find the test payment
   p = Payment.objects.filter(status='VERIFIED').order_by('-created_at').first()
   print(f"Payment: {p.id}, Status: {p.status}, Verified: {p.verified_at}")
   print(f"Order: {p.order.id}, Status: {p.order.status}")
   print(f"Ref Number: {p.ref_number}")
   
   # Check cart is cleared
   cart = p.order.customer.cart
   print(f"Cart items: {cart.items.count()}")  # Should be 0
   ```

#### 7.2 Test Scenarios

بعد از تست موفق اولیه، این سناریوها را تست کنید:

1. **پرداخت موفق**
   - وضعیت سفارش باید CONFIRMED شود
   - سبد خرید باید خالی شود
   - پیامک تأیید باید ارسال شود
   - شماره پیگیری باید ذخیره شود

2. **لغو پرداخت توسط کاربر**
   - بعد از انتقال به زیبال، روی "انصراف" کلیک کنید
   - باید به صفحه result با وضعیت "cancelled" برگردید
   - سبد خرید باید دست‌نخورده بماند

3. **خطای شبکه (simulation)**
   - در لحظه callback، اتصال اینترنت سرور را قطع کنید
   - بعد از 30 دقیقه، reconciliation command را اجرا کنید
   - پرداخت باید تسویه شود

### 8. Security Checklist

- [ ] `DEBUG=False` در production
- [ ] `SECRET_KEY` تولید و امن ذخیره شود
- [ ] `ZIBAL_MERCHANT` واقعی (نه `zibal`)
- [ ] HTTPS فعال و گواهی معتبر
- [ ] `ALLOWED_HOSTS` محدود به دامنه اصلی
- [ ] Database backups روزانه فعال
- [ ] Firewall rules تنظیم شده (فقط 80/443 باز)
- [ ] SSH key-based authentication فعال
- [ ] Log rotation تنظیم شده
- [ ] Rate limiting روی API endpoints

### 9. Rollback Plan

اگر مشکلی پیش آمد:

#### 9.1 Disable Online Payments

**سریع‌ترین راه: Frontend**
```javascript
// Frontend/salyco-front/src/pages/checkout/CheckoutOrder.jsx
// Comment out or disable the online payment button
const handleOnlinePayment = () => {
  alert('پرداخت آنلاین موقتاً غیرفعال است. لطفاً سفارش تلفنی ثبت کنید.');
  return;
  // ... rest of function
};
```

Rebuild و deploy:
```bash
npm run build
rsync -avz --delete dist/ user@server:/var/www/salyco.ir/html/
```

#### 9.2 Database Rollback (Last Resort)

```bash
# Roll back payments migration
python manage.py migrate payments zero

# WARNING: This deletes all payment records!
```

### 10. Post-Deployment Monitoring (First 48 Hours)

اولین 48 ساعت را به دقت نظارت کنید:

1. **هر 2 ساعت:**
   - بررسی logs برای خطاها
   - بررسی پرداخت‌های pending
   - بررسی dashboard admin

2. **روزانه:**
   - مقایسه تعداد پرداخت‌های موفق با گزارش زیبال
   - بررسی شکایات کاربران
   - بررسی تطبیق مبالغ

3. **Alert Conditions:**
   - بیش از 3 پرداخت failed در ساعت
   - هر amount mismatch
   - هر refund log
   - reconciliation command failing

### 11. Support & Troubleshooting

#### مشکلات متداول:

**خطا: "در حال حاضر امکان اتصال به درگاه پرداخت وجود ندارد"**
- بررسی `ZIBAL_MERCHANT` در `.env`
- تست connection با دستورات بخش 1.4
- بررسی firewall سرور برای اتصال به gateway.zibal.ir

**کاربر پرداخت کرده اما سفارش تأیید نشده**
- بررسی callback URL در پنل زیبال
- اجرای reconciliation command دستی
- بررسی logs برای خطای settlement

**"مبلغ پرداخت‌شده با مبلغ سفارش مطابقت ندارد"**
- 🚨 **فوری**: بررسی دستی payment و order
- ممکن است تخفیف/قیمت تغییر کرده باشد
- با پشتیبانی زیبال تماس بگیرید

**Callback URL rejected (result 106)**
- Callback URL باید HTTPS باشد
- باید در پنل زیبال ثبت شده باشد
- بررسی `ZIBAL_CALLBACK_BASE_URL` در `.env`

#### تماس با پشتیبانی زیبال:
- پنل: [gateway.zibal.ir/support](https://gateway.zibal.ir/support)
- مستندات: [docs.zibal.ir](https://docs.zibal.ir)

---

## نکات نهایی

1. **هرگز بدون backup از database تغییری ندهید**
2. **همیشه ابتدا در staging test کنید**
3. **monitoring و alerts را جدی بگیرید**
4. **مستندات این راهنما را به‌روز نگه دارید**

موفق باشید! 🚀
