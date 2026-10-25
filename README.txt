SoftBloomSMP clickable profiles

Replace files at the same relative paths in GitHub:
components/Feed.tsx
components/AppShell.tsx
app/messages/[id]/page.tsx
app/profile/[id]/page.tsx

Post/comment author avatars and names already link to their profiles. This patch additionally links composer avatar/name, private-message header, profile header, and account-dropdown username. Search results, follower lists and message inbox rows already link to profiles. Top-right avatar remains an account-menu button; click its username to open the profile.

No SQL required. Production build not run.
