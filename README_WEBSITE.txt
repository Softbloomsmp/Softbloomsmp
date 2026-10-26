Copy app/ paths into the website repository. Back up database, then apply supabase/softbloom_bridge_v001.sql after existing shop migrations.
Set Vercel SOFTBLOOM_BRIDGE_SECRET, SUPABASE_SERVICE_ROLE_KEY (server only), and NEXT_PUBLIC_SUPABASE_URL. Redeploy.
Linking remains unimplemented; manual recipient entry only. Test in staging first.
