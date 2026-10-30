// =====================================================================
//  CONFIGURATION — le seul fichier à modifier
// =====================================================================

// 1) Supabase > Project Settings > API (ou "API Keys")
//    - URL du projet  : https://xxxxxxxx.supabase.co
//    - Clé publique   : "anon public" ou "publishable" (sb_publishable_...)
//    Cette clé est faite pour être publique : ce sont les règles RLS du
//    fichier supabase/schema.sql qui protègent tes données.
//    NE METS JAMAIS ici la clé "service_role" / "secret".
export const SUPABASE_URL = 'https://liktnzipmurphxtbrfuz.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Vp3Q2BRFyUzR3KO1SKIFrQ_gFTBhGpB';

// 2) Infos affichées en en-tête des devis et factures
export const COMPANY = {
  name: 'Ctrl+S Media',
  tagline: 'Production audiovisuelle & événementielle',
  address: 'Lomé, Togo',
  phone: '',          // ex. '+228 90 00 00 00'
  email: '',
  footer: 'Merci pour votre confiance.',
};

// 3) Prestations proposées dans les devis (prix en FCFA, à ajuster)
export const PRESTATIONS = [
  { label: 'Tournage — demi-journée', price: 0 },
  { label: 'Tournage — journée complète', price: 0 },
  { label: 'Montage vidéo (format court)', price: 0 },
  { label: 'Montage vidéo (format long)', price: 0 },
  { label: 'Prises de vue drone', price: 0 },
  { label: 'Couverture événement', price: 0 },
  { label: 'Community management — 1 mois', price: 0 },
  { label: 'Pack réseaux sociaux (photos + reels)', price: 0 },
];

// 4) Comptes / clients proposés dans le planificateur de contenus
export const COMPTES = ['Ctrl+S Media', 'La Maison des Maillots', 'Miadome'];

// 5) Matériel de tournage par défaut (checklist de chaque tournage)
export const MATERIEL = [
  'Caméra / boîtier', 'Batteries chargées', 'Cartes SD vidées',
  'Objectifs', 'Micro(s) + bonnettes', 'Trépied', 'Stabilisateur',
  'Lumière LED', 'Drone', 'Disque de sauvegarde',
];

// Nom de l'appli
export const APP_NAME = 'AmenHub';
