# Deployment Checklist for MixChief

## 1. Supabase Configuration

### OAuth Redirect URLs
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `pkpuanjooutncztjuvvjz`
3. Navigate to **Authentication** → **URL Configuration**
4. Set these values:
   - **Site URL**: `https://mixchief.vercel.app`
   - **Redirect URLs** (add both):
     - `https://mixchief.vercel.app/**`
     - `http://localhost:3000/**` (for local dev)

## 2. Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `mixchief` project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```
NEXT_PUBLIC_SITE_URL=https://mixchief.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://pkpuanjooutncztjuvvjz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

**Important**: After adding environment variables, you MUST **redeploy** your app for them to take effect.

## 3. Local Development Environment

Create a `.env.local` file in the `djcrate` directory:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://pkpuanjooutncztjuvvjz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

## 4. How the Redirect Logic Works

The app now uses `getSiteUrl()` which:
1. First checks for `NEXT_PUBLIC_SITE_URL` environment variable
2. Falls back to `NEXT_PUBLIC_VERCEL_URL` (auto-set by Vercel)
3. Uses `window.location.origin` if in browser
4. Defaults to `http://localhost:3000` only as last resort

When you sign in, the OAuth flow will redirect to the correct domain based on these settings.

## 5. Testing the Fix

### Production Test:
1. Deploy to Vercel with environment variables set
2. Visit `https://mixchief.vercel.app`
3. Click "Sign in with Google"
4. After OAuth, you should be redirected to `https://mixchief.vercel.app` (not localhost)
5. The app will auto-create your profile and redirect to `/profile/[username]`

### Local Test:
1. Set `.env.local` with localhost URL
2. Run `npm run dev`
3. Visit `http://localhost:3000`
4. Sign in should work and redirect to localhost

## 6. Push to GitHub

```bash
cd "/Users/ranabanankhah/Desktop/dj library/djcrate"
git init
git add .
git commit -m "Add OAuth redirect fixes and deployment configuration"
git remote add origin https://github.com/ranab123/mixchief.git
git branch -M main
git push -u origin main
```

## 7. Verify Deployment

After pushing to GitHub, Vercel should auto-deploy. Check:
- Environment variables are set in Vercel
- Build succeeds
- OAuth redirects to production URL
- Profile creation works
- Share profile button copies production URL

## Troubleshooting

**Still redirecting to localhost?**
- Check Supabase redirect URLs are configured correctly
- Verify `NEXT_PUBLIC_SITE_URL` is set in Vercel
- Make sure you redeployed after setting env vars
- Clear browser cache and cookies

**Build failing?**
- Run `npm run build` locally to test
- Check for TypeScript errors
- Ensure all dependencies are in `package.json`

**Profile not creating?**
- Check Supabase RLS policies are enabled
- Verify `check_username_available` function exists
- Check browser console for errors

