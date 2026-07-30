# SMS.ir OTP Authentication Integration Guide

## Overview

This documentation covers the complete OTP (One-Time Password) authentication system integrated with SMS.ir for your Salyco platform. The system supports:

- **User Registration with OTP verification** via SMS
- **Passwordless Login with OTP** via SMS
- **OTP Resend functionality** with configurable cooldown
- **Rate limiting** and security measures
- **Real SMS delivery** via SMS.ir API

## Configuration

### 1. Environment Variables

Add these variables to your `.env` file in the Backend directory:

```bash
# SMS.ir API Key (get from https://sms.ir/panel/settings)
SMS_IR_API_KEY=JYhqBLNqO9Uk2f6s8ZYjbBJbyUXP14ws5cfSOhlc5zb5tkmA

# SMS.ir Template ID (get from https://sms.ir/panel/templates)
SMS_IR_TEMPLATE_ID=389724
```

### 2. Django Settings

The following settings are pre-configured in `core/settings.py`:

```python
# SMS.ir Configuration
SMS_IR_API_KEY = os.getenv('SMS_IR_API_KEY')
SMS_IR_TEMPLATE_ID = int(os.getenv('SMS_IR_TEMPLATE_ID', 389724))
```

### 3. SMS.ir Setup

#### Create OTP Template

1. Log in to [SMS.ir Panel](https://sms.ir/panel)
2. Go to **Templates** → **Create New Template**
3. Create a template with the following:
   - **Name**: OTP Registration (or similar)
   - **Text**: `کد تأیید شما: #code#` (or your custom message)
   - **Parameter**: `#code#` (exactly as shown)
   - **Type**: Transactional/Verification

4. Note the **Template ID** that appears in the list
5. Add this ID to your `.env` file as `SMS_IR_TEMPLATE_ID`

#### Get API Key

1. Go to **Settings** → **API Keys**
2. Create or copy your API key
3. Add this to your `.env` file as `SMS_IR_API_KEY`

## API Endpoints

### 1. Register with OTP

**Endpoint:** `POST /api/user/register/`

**Request:**
```json
{
  "phone_number": "09120000000",
  "username": "myusername",
  "password": "SecurePassword123",
  "password2": "SecurePassword123"
}
```

**Response (201 Created):**
```json
{
  "detail": "کد تأیید ارسال شد.",
  "phone_number": "09120000000",
  "expires_in": 120
}
```

**Error (503 Service Unavailable):**
```json
{
  "detail": "خطا در ارسال پیامک: [error message]"
}
```

### 2. Verify OTP (Registration)

**Endpoint:** `POST /api/user/verify-otp/`

**Request:**
```json
{
  "phone_number": "09120000000",
  "code": "1234"
}
```

**Response (200 OK):**
```json
{
  "detail": "شماره شما تأیید شد.",
  "access": "eyJ0eXAiOiJKV1QiLC...",
  "refresh": "eyJ0eXAiOiJKV1QiLC..."
}
```

### 3. Resend OTP

**Endpoint:** `POST /api/user/resend-otp/`

**Request:**
```json
{
  "phone_number": "09120000000"
}
```

**Response (200 OK):**
```json
{
  "detail": "کد تأیید مجدداً ارسال شد.",
  "expires_in": 120
}
```

### 4. Request Login OTP

**Endpoint:** `POST /api/user/login-otp/`

**Request:**
```json
{
  "phone_number": "09120000000"
}
```

**Response (200 OK):**
```json
{
  "detail": "کد تأیید ارسال شد.",
  "phone_number": "09120000000",
  "expires_in": 120
}
```

### 5. Verify Login OTP

**Endpoint:** `POST /api/user/verify-otp/`

**Request:**
```json
{
  "phone_number": "09120000000",
  "code": "5678"
}
```

**Response (200 OK):**
```json
{
  "detail": "ورود موفقیت‌آمیز بود.",
  "access": "eyJ0eXAiOiJKV1QiLC...",
  "refresh": "eyJ0eXAiOiJKV1QiLC..."
}
```

## Backend Implementation Details

### SMS Service (`users/sms_service.py`)

Handles all SMS.ir API communication:

```python
from users.sms_service import send_sms_otp

# Send OTP via SMS
success, message = send_sms_otp("09120000000", "1234")
if success:
    print("OTP sent successfully")
else:
    print(f"Error: {message}")
```

**Features:**
- Phone number normalization (handles 09xx, 0912xx, +98912xx formats)
- Timeout handling (10 seconds)
- Connection error handling
- Detailed error messages in Persian
- Logging of all SMS operations

### OTP Model (`users/models.py`)

```python
# Issue new OTP for registration
otp = PhoneOTP.issue(
    phone_number="09120000000",
    purpose=PhoneOTP.PURPOSE_REGISTER
)
code = otp.code  # 4-digit code
expires_in = otp.seconds_remaining()

# Verify OTP code
success, error_message = otp.verify("1234")
```

**Properties:**
- `PURPOSE_REGISTER`: For user registration
- `PURPOSE_LOGIN`: For passwordless login
- Auto-expires after 2 minutes
- Maximum 5 wrong attempts per OTP
- Only the latest OTP can be redeemed (resend invalidates old)

### OTP Settings (`users/otp.py`)

Configurable OTP parameters:

```python
OTP_TTL = timedelta(minutes=2)          # Expiry time
OTP_MAX_ATTEMPTS = 5                    # Max wrong guesses
OTP_LOGIN_ENABLED = True                # Enable/disable OTP login
STATIC_OTP_CODE = None                  # Use real SMS (not static)
```

## Frontend Integration

### React OTP Input Component

The frontend includes an OTP input component with:
- Auto-focus between digits
- 4-digit input fields
- Countdown timer (2 minutes)
- Resend button (available after 30 seconds)
- Error handling and validation
- Loading states

See: `Frontend/salyco-front/src/components/auth/OTPInput.jsx`

## Security Features

1. **Real SMS Delivery**: Codes are sent via SMS.ir API
2. **Secure Code Generation**: Uses `secrets.randbelow()` for cryptographic randomness
3. **Rate Limiting**: Maximum 5 wrong attempts per code
4. **Expiry**: Codes expire after 2 minutes
5. **One-Time Use**: Codes can only be used once
6. **Resend Safety**: New OTP invalidates previous ones
7. **Phone Normalization**: Prevents duplicate entries with different formats
8. **HTTPS Only**: All API calls use HTTPS
9. **JWT Tokens**: Secure session management

## Troubleshooting

### SMS not being sent

**Check:**
1. SMS_IR_API_KEY is correct in `.env`
2. SMS_IR_TEMPLATE_ID matches your SMS.ir panel template
3. Template contains `#code#` placeholder
4. Network connectivity to api.sms.ir
5. Backend logs: `python manage.py runserver` for error details

**Common Errors:**
- `خطا در ارسال پیامک: خطای نامشخص از سرویس پیامک` → Check API key and template ID
- `خطا در اتصال به سرویس پیامک` → Check network/firewall
- `تایم‌اوت در ارسال پیامک` → SMS.ir API timeout, retry

### OTP not verifying

1. Check expiry time hasn't passed (2 minutes)
2. Verify code hasn't been used already
3. Check maximum 5 attempts haven't been exceeded
4. Ensure phone number format matches (09120000000)

## Testing

### Manual Testing

```bash
# Start Django server
python manage.py runserver

# Test registration endpoint
curl -X POST http://localhost:8000/api/user/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "09120000000",
    "username": "testuser",
    "password": "TestPass123",
    "password2": "TestPass123"
  }'

# Check SMS.ir panel for sent message
# Get the code from SMS
# Verify OTP
curl -X POST http://localhost:8000/api/user/verify-otp/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "09120000000",
    "code": "1234"
  }'
```

### Running Tests

```bash
python manage.py test users.tests.OTPTests
```

## Production Deployment

### Checklist

- [ ] `DEBUG = False` in `.env`
- [ ] SMS_IR_API_KEY set in production environment
- [ ] SMS_IR_TEMPLATE_ID verified in SMS.ir panel
- [ ] HTTPS enabled on frontend and backend
- [ ] CORS_ALLOWED_ORIGINS configured correctly
- [ ] Database migrations applied (`python manage.py migrate`)
- [ ] Static files collected (`python manage.py collectstatic`)
- [ ] Error logging configured
- [ ] Rate limiting configured at server level

### Environment Variables

```bash
# Production .env
DEBUG=False
SECRET_KEY=[generate-new-random-key]
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
SMS_IR_API_KEY=[your-api-key]
SMS_IR_TEMPLATE_ID=[your-template-id]
```

## Support & Resources

- **SMS.ir Documentation**: https://sms.ir/rest-api/
- **SMS.ir Panel**: https://sms.ir/panel/
- **API Key Location**: https://sms.ir/panel/settings
- **Templates Management**: https://sms.ir/panel/templates

## Implementation Status

✅ Backend SMS.ir integration complete
✅ OTP generation and verification
✅ Phone number normalization
✅ Error handling and logging
✅ Environment configuration
✅ Both registration and login OTP flows enabled
⏳ Frontend OTP UI components (use your existing implementation)

---

**Last Updated**: 2026-07-30
**Version**: 1.0
