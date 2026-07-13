// Runtime config. The Worker answers only low-confidence conversations, with consent.
// Until it is deployed with PUBLIC_READ="on", the cloud path returns 403 and the app degrades
// gracefully ("cloud read is not open yet").
export const API_BASE = 'https://whatdoyoumean-api.damummyphus.workers.dev';

// Shared damlahelloworld Supabase (identity server for all apps). Anon key is public by design;
// row-level security protects data. This app uses wdym_-prefixed tables.
export const SUPABASE_URL = 'https://xjtmqncfhuidctxgthhv.supabase.co';
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqdG1xbmNmaHVpZGN0eGd0aGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4OTQ5NTcsImV4cCI6MjA5OTQ3MDk1N30.xQ2-SY7gT1BsI7isodRgKtaqyDSIzjDbgHyjOYMt_8g';
