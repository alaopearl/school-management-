# OTP & Email Setup Guide

## Overview
The system now has a 2-step school registration process with OTP verification sent to the school's email address.

## Setup Instructions

### 1. Configure Environment Variables

Create or update your `.env` file in the `backend/` folder:

```env
# Server
PORT=5000
NODE_ENV=production  # Change to 'development' for testing
DATABASE_PATH=./students.db
JWT_SECRET=your-strong-secret-key-here
JWT_EXPIRES_IN=1d

# SMTP Settings for Email/OTP (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password  # Use App Password for Gmail (not regular password)
SMTP_FROM=School Admin <your-gmail@gmail.com>
```

### 2. Gmail Setup (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Create an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your device)
   - Google will generate a 16-character password
   - Use this password in `SMTP_PASS` (not your regular Gmail password)

### 3. School Registration Flow

#### Step 1: Request OTP
```bash
curl -X POST http://localhost:5000/api/auth/register-school \
  -H "Content-Type: application/json" \
  -d '{
    "schoolName": "Excellence Academy",
    "schoolCode": "EA-2024",
    "email": "principal@excellence.com",
    "phone": "+234-123-456-7890",
    "principalName": "John Doe",
    "address": "123 School Street",
    "schoolType": "Primary"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to your email. Please check your inbox.",
  "requiresOtp": true,
  "otp": "123456"  // Only in development mode
}
```

#### Step 2: Verify OTP and Register
```bash
curl -X POST http://localhost:5000/api/auth/register-school \
  -H "Content-Type: application/json" \
  -d '{
    "schoolName": "Excellence Academy",
    "schoolCode": "EA-2024",
    "email": "principal@excellence.com",
    "phone": "+234-123-456-7890",
    "principalName": "John Doe",
    "address": "123 School Street",
    "schoolType": "Primary",
    "otp": "123456"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "School registered successfully",
  "data": {
    "id": "uuid-here",
    "name": "Excellence Academy",
    "code": "EA-2024",
    "email": "principal@excellence.com",
    "status": "ACTIVE"
  }
}
```

## Troubleshooting

### "OTP sent (check console in development)"
- SMTP is not configured properly
- Check your `.env` file settings
- In development mode, check your terminal for the OTP code

### "Failed to send OTP email"
- Invalid Gmail credentials
- Gmail account doesn't allow "Less secure apps"
- Use App Password instead of regular Gmail password
- Check that 2-Factor Authentication is enabled

### Test in Development Mode
```env
NODE_ENV=development
```
- OTP codes will be logged to console
- OTP will also be included in API response
- No need to check email for testing

## Additional Notes

- OTP expires after 10 minutes
- Maximum 5 failed verification attempts before OTP is cleared
- All emails are sent via Nodemailer
- System supports other SMTP providers (SendGrid, MailerSend, etc.)

## Other Email Features

The same SMTP configuration is used for:
- ✅ Password reset OTPs
- ✅ Account verification
- ✅ System notifications
- ✅ Parent portal communications

