// Supabase connection for the sign-up form.
// Both values are safe to publish: the publishable key can only do what the
// table's row-level security allows (insert sign-ups, never read them).
// Find them in Supabase: Project Settings → API Keys / Data API.
window.YAH_CONFIG = {
  SUPABASE_URL: 'https://oobwaxqijzkiwsgyzhbe.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'PASTE_YOUR_PUBLISHABLE_KEY_HERE',
  TABLE: 'yah_signups'
};
