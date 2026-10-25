# SoftBloomSMP 🌸

Minecraft cherry-blossom themed social community, built with Next.js, Supabase and Vercel.

## Setup

1. Install Node.js 20.9+ and run `npm install`.
2. Create a Supabase project. In **SQL Editor**, paste and run `supabase/schema.sql` on a fresh project.
3. In Supabase **Authentication → Providers**, enable **Google** and **Discord**. Create OAuth apps at Google Cloud Console and Discord Developer Portal. For both providers, set the provider application's redirect/callback URL to `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` (the exact URL is shown in Supabase provider settings). Paste each provider's client ID and secret **only into Supabase provider settings**.
4. In Supabase **Authentication → URL Configuration**, set Site URL to your Vercel domain and add redirect allow-list entries `http://localhost:3000/auth/callback` and `https://YOUR_VERCEL_DOMAIN/auth/callback`. Include any custom production domain when added.
5. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase publishable/anon key), `SUPABASE_SERVICE_ROLE_KEY` (private service role key), and `NEXT_PUBLIC_SITE_URL`. **Never commit `.env.local`**. Public Supabase URL and anon key are not secret; private service-role key is.
6. Run `npm run dev` and open http://localhost:3000.
7. Upload the project folder contents to the root of your GitHub repository (not the enclosing folder). Do **not** upload `.env.local` or secrets.
8. In Vercel, **Add New → Project → Import Git Repository**. Framework: Next.js; root directory: repository root. Add the same four environment variables under **Project → Settings → Environment Variables**, with `NEXT_PUBLIC_SITE_URL` set to your deployed `https://...vercel.app` address. Redeploy after setting them.
9. Update Supabase Authentication URL Configuration with the real deployed domain and test both OAuth providers, post creation, media upload, and profile editing.

## Implemented
- Responsive pink branding, logo, blurred Minecraft-inspired pixel terrain and animated cherry petals (reduced-motion supported)
- Public community feed; OAuth Google/Discord login; guest Sign Up and authenticated dropdown
- Search user profiles by username; public profiles, follow/unfollow, followers/followed and post pages
- Up to five existing posts per account (database trigger serializes concurrent creates)
- Text/emoji posts, one photo (3 MB) or video (10 MB), screenshot paste, edit/delete own posts
- Comments (edit/delete own), one emoji reaction per user per post
- Username change once per 7 days enforced by database trigger; bio editing
- Row-level security, private upload credential, signature and size validation, security headers

## Before accepting public traffic
This is a functional first version, **not a completed penetration-tested production deployment**. Add rate limiting at Vercel/WAF for upload and write routes, content moderation and abuse reporting, media transcoding/virus scanning as needed, pagination for large feeds, cleanup of orphaned media after replacement/deletion, and operational backups/monitoring. In particular, the upload endpoint currently permits authenticated users to upload media even if they do not ultimately publish a post; impose per-user quotas and cleanup before scaling. Public media URLs are public by design. Do not put private data in posts or attachments. Review OAuth provider verification requirements.

## Notes
- The logo in `public/softbloom-logo.png` is your uploaded image.
- There is no traditional password signup; first OAuth login creates a Supabase account.
- Never place a service-role key in a `NEXT_PUBLIC_` variable.
- Changing a username preserves account IDs, followers, posts and profile URLs.
