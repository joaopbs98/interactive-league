# Supabase Authentication Setup Guide

## 1. Configure Site URL in Supabase

Go to your [Supabase Dashboard](https://app.supabase.com/) → Authentication → URL Configuration

**IMPORTANT:** Set the **Site URL** to match your current development port:
- If running on port 3000: `http://localhost:3000`
- If running on port 3001: `http://localhost:3001` ⬅️ **Use this one**
- If running on port 3002: `http://localhost:3002`

## 2. Configure Google OAuth (if using Google login)

### In Supabase Dashboard:
1. Go to **Authentication → Providers → Google**
2. Enable Google provider
3. Add your Google OAuth credentials (Client ID and Client Secret)

### In Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add these **Authorized redirect URIs**:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3001/auth/callback
   http://localhost:3002/auth/callback
   http://127.0.0.1:3000/auth/callback
   http://127.0.0.1:3001/auth/callback
   http://127.0.0.1:3002/auth/callback
   ```

## 3. Environment Variables

Make sure your `.env.local` has:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

**Note:** Update `NEXT_PUBLIC_SITE_URL` to match your current port (3001).

## 4. Fix PKCE Error (Code Challenge Mismatch)

If you see "code challenge does not match previously saved code verifier":

1. **Clear browser cache and cookies** for localhost
2. **Restart the development server**:
   ```bash
   npm run dev
   ```
3. **Make sure Supabase Site URL matches your current port** (3001)
4. **Try in an incognito/private window**
5. **Check that Google OAuth redirect URIs include your current port**

## 5. Test the Flow

1. Try signing up with email/password
2. Check your email for confirmation link
3. Click the confirmation link - it should now work!
4. Try logging in with the confirmed account
5. Try Google OAuth login

## 6. Fix Hydration Errors

If you see hydration errors like "Cannot read properties of undefined (reading 'bind')":

1. **Clear browser cache and cookies**
2. **Restart the development server**:
   ```bash
   npm run dev
   ```
3. **Check the console for specific error messages**
4. **Make sure all environment variables are set correctly**

## Troubleshooting

- **Email confirmation doesn't work**: Check the Site URL in Supabase matches your current port
- **Google OAuth fails**: Check the redirect URIs in Google Cloud Console
- **PKCE error**: Clear cache, restart dev server, check port configuration
- **Hydration errors**: Clear cache, restart dev server, check environment variables
- **Port issues**: Make sure Supabase Site URL matches your current development port
- Check browser console for any error messages 