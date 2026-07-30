"""
SMS.ir API integration service for sending OTP verification codes.
"""
import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class SMSService:
    """SMS.ir API client for sending verification codes."""

    BASE_URL = "https://api.sms.ir/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            'Content-Type': 'application/json',
            'Accept': 'text/plain',
            'x-api-key': self.api_key
        }

    def send_otp(self, phone_number: str, code: str, template_id: int) -> tuple[bool, str]:
        """
        Send OTP code via SMS.ir

        Args:
            phone_number: Recipient phone number (format: 09120000000)
            code: 4-digit OTP code
            template_id: SMS template ID from SMS.ir panel

        Returns:
            tuple(success: bool, message: str)
        """
        try:
            # Clean and format phone number
            cleaned_phone = self._normalize_phone(phone_number)

            # Prepare request payload
            payload = {
                "mobile": cleaned_phone,
                "templateId": template_id,
                "parameters": [
                    {
                        "name": "code",  # Matches template parameter #code#
                        "value": code
                    }
                ]
            }

            # Send request to SMS.ir
            response = requests.post(
                f"{self.BASE_URL}/send/verify",
                headers=self.headers,
                json=payload,
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("status") == 1:
                    logger.info(f"OTP sent successfully to {phone_number}, messageId: {data.get('data', {}).get('messageId')}")
                    return True, "کد تأیید با موفقیت ارسال شد."
                else:
                    error_msg = data.get("message", "خطای نامشخص از سرویس پیامک")
                    logger.error(f"SMS.ir error for {phone_number}: {error_msg}")
                    return False, f"خطا در ارسال پیامک: {error_msg}"
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logger.error(f"HTTP error for {phone_number}: {error_msg}")
                return False, "خطا در ارتباط با سرویس پیامک"

        except requests.exceptions.Timeout:
            logger.error(f"Timeout sending OTP to {phone_number}")
            return False, "تایم‌اوت در ارسال پیامک"
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error sending OTP to {phone_number}")
            return False, "خطا در اتصال به سرویس پیامک"
        except Exception as e:
            logger.error(f"Unexpected error sending OTP to {phone_number}: {str(e)}")
            return False, "خطای داخلی در ارسال پیامک"

    def _normalize_phone(self, phone: str) -> str:
        """
        Normalize Iranian phone number to format required by SMS.ir

        Args:
            phone: Phone number (various formats: 0912..., +98912..., 912..., etc.)

        Returns:
            Normalized phone number (91200000000 format)
        """
        # Remove all non-digit characters
        cleaned = ''.join(filter(str.isdigit, phone))

        # Handle Iranian mobile numbers
        if cleaned.startswith('98'):
            # +98912... format
            return cleaned[2:]  # Remove 98 prefix
        elif cleaned.startswith('0') and len(cleaned) == 11:
            # 0912... format
            return cleaned[1:]  # Remove leading 0
        elif cleaned.startswith('9') and len(cleaned) == 10:
            # 912... format (already correct)
            return cleaned
        else:
            # Return as-is, SMS.ir will validate
            return cleaned


# Singleton instance
_sms_service = None


def get_sms_service() -> SMSService:
    """Get or create SMS.ir service instance."""
    global _sms_service

    if _sms_service is None:
        api_key = getattr(settings, 'SMS_IR_API_KEY', None)
        if not api_key:
            raise ValueError("SMS_IR_API_KEY not configured in settings")

        _sms_service = SMSService(api_key)

    return _sms_service


def send_sms_otp(phone_number: str, code: str) -> tuple[bool, str]:
    """
    Send OTP code via SMS.ir (main integration function)

    This replaces the placeholder send_otp_sms function in otp.py
    """
    service = get_sms_service()
    template_id = getattr(settings, 'SMS_IR_TEMPLATE_ID', 389724)
    return service.send_otp(phone_number, code, template_id)