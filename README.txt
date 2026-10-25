SoftBloomSMP visual polish — updated files only

Replace app/globals.css with the included file.
Add app/template.tsx and app/loading.tsx.
No other files need to be replaced. The existing login gate, blurred sunset, petals, feed, and messaging are retained.
The Next.js route loader is shown when a navigation suspends; quick cached navigations may skip it. The page-enter animation is intentionally short.
No database or Supabase changes required.
