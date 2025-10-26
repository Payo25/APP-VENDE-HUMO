# Email and SMS Notification Setup

This guide will help you configure email and SMS notifications for the Surgical Forms app.

## Email Notifications (SendGrid)

### Step 1: Create a SendGrid Account
1. Go to https://signup.sendgrid.com/
2. Sign up for a free account (100 emails/day free)
3. Verify your email address

### Step 2: Create an API Key
1. Log in to SendGrid dashboard
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Name it "Surgical Forms Notifications"
5. Select **Full Access** permissions
6. Click **Create & View**
7. **Copy the API key** (you won't be able to see it again!)

### Step 3: Verify a Sender Email
1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in your details (use your real email address)
4. Verify the email you receive from SendGrid

### Step 4: Add to Azure App Service
1. Go to Azure Portal → surgical-backend App Service
2. Go to **Environment variables** (or **Configuration**)
3. Add these application settings:
   - **Name**: `SENDGRID_API_KEY`
     **Value**: [Your SendGrid API key from Step 2]
   
   - **Name**: `NOTIFICATION_EMAIL_FROM`
     **Value**: [The verified sender email from Step 3, e.g., notifications@yourdomain.com]
   
   - **Name**: `NOTIFICATION_EMAIL_TO`
     **Value**: [Email addresses to receive notifications, comma-separated, e.g., doctor1@example.com,doctor2@example.com]
   
   - **Name**: `APP_URL`
     **Value**: `https://surgical-backend-abdma0d0fpdme6e8.canadacentral-01.azurewebsites.net`

4. Click **Save**
5. Wait for app to restart (1-2 minutes)

---

## SMS Notifications (Twilio)

### Step 1: Create a Twilio Account
1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free trial account
3. Verify your phone number

### Step 2: Get Your Credentials
1. Log in to Twilio Console
2. On the dashboard, you'll see:
   - **Account SID**
   - **Auth Token**
3. Copy both values

### Step 3: Get a Phone Number
1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. For trial accounts, you get one free number
3. Select a number with SMS capability
4. Click **Buy**
5. Copy your Twilio phone number (format: +1XXXXXXXXXX)

### Step 4: Add to Azure App Service
1. Go to Azure Portal → surgical-backend App Service
2. Go to **Environment variables** (or **Configuration**)
3. Add these application settings:
   - **Name**: `TWILIO_ACCOUNT_SID`
     **Value**: [Your Account SID from Step 2]
   
   - **Name**: `TWILIO_AUTH_TOKEN`
     **Value**: [Your Auth Token from Step 2]
   
   - **Name**: `TWILIO_PHONE_FROM`
     **Value**: [Your Twilio phone number, e.g., +12345678900]
   
   - **Name**: `NOTIFICATION_PHONE_TO`
     **Value**: [Phone numbers to receive SMS, comma-separated in E.164 format, e.g., +18095551234,+18095555678]

4. Click **Save**
5. Wait for app to restart (1-2 minutes)

---

## Testing

After configuring the environment variables:

1. Log in as a Business Assistant
2. Go to **Call Hours Planner**
3. Create a new schedule for a month that doesn't have one yet
4. Click **Save Schedule**

You should receive:
- ✉️ An email notification with the schedule details
- 📱 An SMS notification with a brief summary

---

## Important Notes

### SendGrid Free Tier
- 100 emails/day free forever
- Upgrade for more volume if needed

### Twilio Trial Account Limitations
- Can only send SMS to **verified phone numbers**
- To verify a phone number:
  1. Go to Twilio Console → **Phone Numbers** → **Verified Caller IDs**
  2. Click **Add a new Caller ID**
  3. Enter the phone number
  4. Verify via SMS code
- Upgrade to a paid account to send to any phone number

### Multiple Recipients
- For emails: Use comma-separated emails in `NOTIFICATION_EMAIL_TO`
  - Example: `doctor1@example.com,doctor2@example.com,admin@example.com`

- For SMS: Use comma-separated phone numbers in E.164 format in `NOTIFICATION_PHONE_TO`
  - Example: `+18095551234,+18095555678,+18095559999`

### Disabling Notifications
- To disable email: Don't set `SENDGRID_API_KEY`
- To disable SMS: Don't set Twilio credentials
- The app will work fine without notifications

---

## Troubleshooting

If notifications aren't working:

1. Check Azure App Service logs:
   - Go to surgical-backend → **Log stream**
   - Look for ✅ or ❌ messages about SendGrid/Twilio

2. Verify environment variables are set correctly in Azure App Service

3. For SendGrid:
   - Verify your sender email in SendGrid dashboard
   - Check API key has Full Access permissions

4. For Twilio:
   - Verify recipient phone numbers in trial account
   - Ensure phone numbers are in E.164 format (+countrycode + number)

5. Check the browser console for any errors when saving the schedule
