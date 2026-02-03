# Cloudflare Pages Deployment Guide

## Prerequisites

1. Cloudflare account
2. GitHub repository (or GitLab/Bitbucket)
3. Git initialized and committed

## Deployment Steps

### Option 1: Via Cloudflare Dashboard (Recommended)

1. **Push to GitHub**:

   ```bash
   # Add remote (replace with your repo URL)
   git remote add origin https://github.com/yourusername/web-freezer.git

   # Push to GitHub
   git push -u origin master
   ```

2. **Connect to Cloudflare Pages**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to **Workers & Pages** → **Create Application** → **Pages**
   - Click **Connect to Git**
   - Select your repository: `web-freezer`
   - Configure build settings:
     - **Framework preset**: Next.js
     - **Build command**: `pnpm run pages:build`
     - **Build output directory**: `.open-next/worker`
     - **Node version**: 22

3. **Deploy**:
   - Click **Save and Deploy**
   - Wait for build to complete (~2-3 minutes)
   - Your site will be live at `https://web-freezer-xxx.pages.dev`

### Option 2: Via Wrangler CLI

```bash
# Login to Cloudflare
wrangler login

# Build for production
pnpm run pages:build

# Deploy
wrangler pages deploy .open-next/worker --project-name=web-freezer
```

## Environment Variables (Optional)

If using AI features, set in Cloudflare Dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add:
   - `GEMINI_API_KEY`: Your Gemini API key
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

## Troubleshooting

### Build Timeout

**Cause**: Large dependencies or slow network.

**Solution**:

- Cloudflare Pages has 20-minute build timeout
- If timeout occurs, try deploying again (cached dependencies will speed up)

### Runtime Errors

**Cause**: Edge runtime incompatibilities.

**Solution**:

- Check Cloudflare Pages logs
- Ensure all dependencies are compatible with Edge runtime
- Avoid Node.js-specific APIs (use Web APIs instead)

## Custom Domain (Optional)

1. Go to **Custom Domains** in Cloudflare Pages
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `webfreezer.com`)
4. Follow DNS configuration instructions

## Monitoring

- **Analytics**: Cloudflare Dashboard → Pages → Analytics
- **Logs**: Cloudflare Dashboard → Pages → Deployments → View Logs
- **Errors**: Check Functions logs for API errors

## Cost

- **Free Tier**:
  - 500 builds/month
  - Unlimited requests
  - 100GB bandwidth/month
  - Perfect for this project!

## Next Steps

1. Push code to GitHub
2. Connect to Cloudflare Pages
3. Deploy
4. Test live site
5. (Optional) Add custom domain

---

**Status**: Ready to deploy! 🚀
