// Auth + premium status on the SHARED damlahelloworld Supabase (one identity server for all apps).
// Magic-link (passwordless) sign-in. Premium is read from wdym_profiles. Everything degrades
// gracefully: if the client can't load or the tables aren't there yet, the app keeps working with
// the local free quota and simply shows nobody as premium.

import { SUPABASE_URL, SUPABASE_ANON } from './config.js?v=3';

let client = null;
let ready = null;

async function getClient() {
  if (client) return client;
  if (!ready) {
    ready = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => {
        client = createClient(SUPABASE_URL, SUPABASE_ANON, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        return client;
      })
      .catch(() => null);
  }
  return ready;
}

export async function getUser() {
  const c = await getClient();
  if (!c) return null;
  const { data } = await c.auth.getUser();
  return data?.user || null;
}

export async function sendMagicLink(email) {
  const c = await getClient();
  if (!c) throw new Error('Giriş şu an yapılamıyor.');
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw new Error('Bağlantı gönderilemedi, e-postanı kontrol et.');
}

export async function signOut() {
  const c = await getClient();
  if (c) await c.auth.signOut();
}

// Reads wdym_profiles.is_premium for the signed-in user. Returns false on any error / no session /
// missing table, so the paywall never blocks by accident.
export async function isPremium() {
  const c = await getClient();
  if (!c) return false;
  const { data: u } = await c.auth.getUser();
  if (!u?.user) return false;
  const { data, error } = await c.from('wdym_profiles').select('is_premium').eq('id', u.user.id).maybeSingle();
  if (error) return false;
  return !!data?.is_premium;
}

export async function onAuthChange(cb) {
  const c = await getClient();
  if (c) c.auth.onAuthStateChange((_e, session) => cb(session?.user || null));
}
