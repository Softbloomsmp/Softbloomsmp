SoftBloomSMP website patch (only changed files)
1. Copy app/shop/page.tsx and app/api/bridge/route.ts to corresponding website paths.
2. If not previously run, apply supabase/softbloom_bridge_v001.sql from your earlier release first.
3. Run supabase/softbloom_bridge_v002_stash.sql ONCE in Supabase SQL Editor.
4. Confirm Vercel server-side env: SOFTBLOOM_BRIDGE_SECRET and SUPABASE_SERVICE_ROLE_KEY. Redeploy.
5. Product editor now has Reward Type: Item (/mystash voucher) or Non-item (automatic).
IMPORTANT: This is a staging patch; do not use for live payments before testing delivery, crash recovery and legacy RPC paths.
