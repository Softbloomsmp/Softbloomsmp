SoftBloomSMP Homepage Feed Fix
- Loads posts separately from profiles to avoid failing embedded joins.
- Displays actual feed errors.
- Refreshes feed when tab becomes visible and every 20 seconds.
- Uses exact per-user post counts.
- Does not modify Supabase schema, RLS, OAuth, or existing data.
Upload project to GitHub, let Vercel redeploy, and verify the homepage.

- Removed the homepage welcome banner and tagline above the post composer.
