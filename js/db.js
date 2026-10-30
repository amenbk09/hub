// Accès aux données (Supabase) + cache local pour la lecture hors ligne
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configured = !SUPABASE_URL.includes('VOTRE-PROJET') && !SUPABASE_ANON_KEY.includes('VOTRE-CLE');

export const sb = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

const cacheKey = k => `amenhub:cache:${k}`;
const readCache = k => { try { return JSON.parse(localStorage.getItem(cacheKey(k)) || 'null'); } catch { return null; } };
const writeCache = (k, v) => { try { localStorage.setItem(cacheKey(k), JSON.stringify(v)); } catch { /* quota */ } };
export const clearCache = () => {
  try { Object.keys(localStorage).filter(k => k.startsWith('amenhub:cache:')).forEach(k => localStorage.removeItem(k)); } catch { }
};

export let offline = false;
const markOnline = () => { offline = false; document.documentElement.classList.remove('is-offline'); };
const markOffline = () => { offline = true; document.documentElement.classList.add('is-offline'); };

// ---------- Session & profil ----------
export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() {
  clearCache();
  await sb.auth.signOut();
}
export async function getProfile() {
  const session = await getSession();
  if (!session) return null;
  try {
    const { data, error } = await sb.from('profiles').select('id, display_name, role').eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    if (data) writeCache('profile', data);
    markOnline();
    return data;
  } catch (e) {
    const c = readCache('profile');
    if (c && c.id === session.user.id) { markOffline(); return c; }
    throw e;
  }
}

// ---------- Éléments privés (admin) ----------
export async function listItems(kind) {
  try {
    const { data, error } = await sb.from('items').select('*').eq('kind', kind).order('created_at', { ascending: false });
    if (error) throw error;
    writeCache(`items:${kind}`, data);
    markOnline();
    return data;
  } catch (e) {
    const c = readCache(`items:${kind}`);
    if (c) { markOffline(); return c; }
    throw e;
  }
}
export async function saveItem(kind, data, id) {
  const q = id
    ? sb.from('items').update({ data }).eq('id', id).select().single()
    : sb.from('items').insert({ kind, data }).select().single();
  const { data: row, error } = await q;
  if (error) throw error;
  return row;
}
export async function deleteItem(id) {
  const { error } = await sb.from('items').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Idées Miadome (partagées) ----------
export async function listIdeas() {
  try {
    const { data, error } = await sb.from('ideas').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    writeCache('ideas', data);
    markOnline();
    return data;
  } catch (e) {
    const c = readCache('ideas');
    if (c) { markOffline(); return c; }
    throw e;
  }
}
export async function addIdea(idea) {
  const { error } = await sb.from('ideas').insert(idea);
  if (error) throw error;
}
export async function updateIdea(id, patch) {
  const { error } = await sb.from('ideas').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteIdea(id) {
  const { error } = await sb.from('ideas').delete().eq('id', id);
  if (error) throw error;
}
export function onIdeasChange(cb) {
  const ch = sb.channel('ideas-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, cb)
    .subscribe();
  return () => sb.removeChannel(ch);
}

// Message d'erreur lisible
export function errMsg(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Pas de connexion internet.';
  if (/row-level security|permission denied/i.test(m)) return "Action non autorisée pour ton compte.";
  return m;
}
