# Google Ads API Token Refresh Guide

## Problem
You're seeing an `invalid_grant` error, which means your Google Ads API refresh token has expired or been revoked.

## Solution

### Step 1: Install Required Package (if not already installed)
```bash
npm install googleapis
```

### Step 2: Run the Token Generator Script
```bash
node src/scripts/BlogGenerator/regenerateToken.js
```

### Step 3: Follow the Instructions
1. The script will output a URL - copy and open it in your browser
2. Log in with the Google account that has access to your Google Ads account
3. Grant the requested permissions
4. Copy the authorization code from the browser
5. Paste it back into the terminal

### Step 4: Update Your .env File
The script will output a new `REFRESH_TOKEN`. Update your `.env` file:

```env
REFRESH_TOKEN=your_new_refresh_token_here
```

### Step 5: Restart Your Application
```bash
npm start
```

## Alternative: Manual Token Generation

If the script doesn't work, you can manually generate a token:

1. **Visit OAuth Playground**: https://developers.google.com/oauthplayground/

2. **Configure Settings** (click the gear icon in top-right):
   - Check "Use your own OAuth credentials"
   - Enter your `GOOGLE_ADS_CLIENT_ID`
   - Enter your `GOOGLE_ADS_CLIENT_SECRET`

3. **Select Scopes**:
   - Find and select: `https://www.googleapis.com/auth/adwords`

4. **Authorize APIs**:
   - Click "Authorize APIs"
   - Log in and grant permissions

5. **Exchange Authorization Code**:
   - Click "Exchange authorization code for tokens"
   - Copy the `refresh_token` from the response

6. **Update .env**:
   - Replace `REFRESH_TOKEN` with the new token

## Why Does This Happen?

- **Inactivity**: Tokens expire after 6 months of non-use
- **Revocation**: User manually revoked access in Google Account settings
- **Credentials Changed**: OAuth client credentials were regenerated
- **Scope Changes**: Required scopes were modified

## Preventing Future Issues

1. **Regular Use**: Use the API at least once every 6 months
2. **Backup Tokens**: Keep a record of your tokens securely
3. **Monitor Errors**: Set up alerts for authentication failures
4. **Test Environment**: Keep a test setup to verify credentials

## Required Environment Variables

Make sure your `.env` file has all these values:

```env
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
DEVELOPER_TOKEN=your_developer_token
CUSTOMER_ID=1234567890
REFRESH_TOKEN=your_refresh_token
```

**Note**: `CUSTOMER_ID` should NOT include dashes (e.g., `1234567890` not `123-456-7890`)

## Need Help?

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Google Ads API Forum](https://groups.google.com/g/adwords-api)
