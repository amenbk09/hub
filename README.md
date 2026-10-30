# AmenHub

Application mobile (PWA) personnelle : agenda vocal avec rappels, idées Miadome partagées, planificateur de contenus, mini-CRM, devis et factures, tournages, boîte à outils réseau et révisions cybersécurité.

- **Front** : HTML/CSS/JS sans build, hébergé gratuitement sur **GitHub Pages**
- **Données et comptes** : **Supabase** (base PostgreSQL + authentification), offre gratuite
- **Sécurité** : règles RLS côté serveur. Les collègues n'accèdent qu'aux idées Miadome, même s'ils modifient le code.

---

## Étape 1 : créer la base Supabase (10 min)

1. Va sur **supabase.com** → *Start your project* → connecte-toi avec GitHub.
2. *New project* : nom `amenhub`, un mot de passe de base de données solide (garde-le), région la plus proche (Europe, par exemple *West EU / Paris* ou *Frankfurt*).
3. Une fois le projet prêt : menu **SQL Editor** → *New query* → colle **tout** le contenu de `supabase/schema.sql` → **Run**. Le message attendu est « Success. No rows returned ».
4. **Désactive les inscriptions publiques**, pour que personne ne puisse se créer un compte seul :
   **Authentication → Sign In / Providers** (ou *Settings*) → décoche **Allow new users to sign up** → Save.

## Étape 2 : créer les comptes

1. **Authentication → Users → Add user → Create new user**
   - ton e-mail + un mot de passe, coche **Auto Confirm User**.
2. Passe-toi **admin** : SQL Editor → nouvelle requête :
   ```sql
   update public.profiles set role = 'admin', display_name = 'Amen'
   where id = (select id from auth.users where email = 'TON_EMAIL');
   ```
3. Pour chaque collègue de Miadome : *Add user* avec son e-mail et un mot de passe provisoire (Auto Confirm). Il est automatiquement **collab**. Donne-lui un prénom affiché :
   ```sql
   update public.profiles set display_name = 'Kafui'
   where id = (select id from auth.users where email = 'email_du_collegue');
   ```

## Étape 3 : relier l'appli à Supabase

1. Supabase → **Project Settings → API** (ou *API Keys*) : copie
   - **Project URL** (`https://xxxx.supabase.co`)
   - la clé **anon public** / **publishable** (jamais la clé *service_role* / *secret*).
2. Ouvre `js/config.js` et remplace `SUPABASE_URL` et `SUPABASE_ANON_KEY`.
3. Profites-en pour remplir `COMPANY` (téléphone, e-mail pour les devis) et les **prix** dans `PRESTATIONS`.

> La clé publique est faite pour être visible dans le code. Ce sont les règles RLS de `schema.sql` qui protègent les données.

## Étape 4 : mettre en ligne sur GitHub Pages

**Sans ligne de commande :**
1. github.com → **New repository** → nom `hub` (ou autre) → **Public** → Create.
2. *uploading an existing file* → glisse **le contenu** du dossier `amenhub` (index.html, css/, js/, icons/, sw.js, manifest.webmanifest…) → Commit.
3. **Settings → Pages** → *Source : Deploy from a branch* → branche `main`, dossier `/ (root)` → Save.
4. Une à deux minutes plus tard, l'appli est en ligne sur **https://amenbk09.github.io/hub/**

**Avec Git :**
```bash
cd amenhub
git init && git add . && git commit -m "AmenHub v1"
git branch -M main
git remote add origin https://github.com/amenbk09/hub.git
git push -u origin main
```
Puis active Pages comme ci-dessus.

> GitHub Pages gratuit exige un dépôt public : le **code** est visible, mais **pas tes données** (elles sont dans Supabase, derrière la connexion).

## Étape 5 : installer sur l'iPhone

1. Ouvre **https://amenbk09.github.io/hub/** dans **Safari** (pas Chrome).
2. Bouton **Partager** → **Sur l'écran d'accueil** → Ajouter.
3. Lance AmenHub depuis l'icône et connecte-toi.
4. Envoie le même lien à tes collègues : après connexion, ils ne verront **que** les idées Miadome.

---

## Utilisation

### Rendez-vous (onglet Agenda)
- Écris ou dicte (bouton micro) : *« RDV mardi 15h à l'hôtel pour le devis »*. L'appli détecte la date, l'heure et le titre, et tu peux corriger.
- Choisis **quand être rappelé** (au moment, 15 min, 1 h, la veille, ou une heure précise).
- Après l'enregistrement, **Calendrier de l'iPhone** ajoute l'événement **avec son rappel**. C'est le calendrier qui envoie la notification, même appli fermée.
- Si la dictée intégrée ne marche pas dans l'appli installée, utilise le **micro du clavier iPhone**, qui fonctionne partout.

Expressions reconnues : *aujourd'hui, demain, après-demain, ce soir, lundi…dimanche, vendredi prochain, dans 3 jours, le 12, le 12 novembre, 12/11, 15h, 15h30, 15:30, midi, 4h de l'après-midi*.

### Idées Miadome (partagées)
- Les collègues proposent : titre, description, lieu, lien TikTok/Instagram.
- Toi, tu **valides**, **refuses** ou demandes **à retravailler** avec un commentaire. Quand l'auteur modifie une idée « à retravailler », elle repasse « en attente ».
- Les mises à jour arrivent en direct.

### Devis et factures
- Prestations prédéfinies (prix dans `config.js`), quantités, remise et total en FCFA.
- **PDF** : Imprimer → sur iPhone, touche **Partager** dans l'aperçu → *Enregistrer dans Fichiers*.
- **→ Facture** convertit un devis accepté en facture numérotée.
- Envoi d'un récapitulatif par **WhatsApp**.

### Autres modules
**Contenus** (calendrier de publication multi-comptes, légendes à copier) · **Clients** (prospection d'hôtels, relances, WhatsApp/appel en un tap) · **Tournages** (checklist matériel, shot list) · **Réseau** (calcul IP, VLSM, aide-mémoire Cisco/MikroTik/pfSense/Linux/Windows, journal d'interventions) · **Révisions** (flashcards avec paquet de départ).

---

## Mettre à jour l'appli
Modifie les fichiers, renvoie-les sur GitHub, puis **change `VERSION` dans `sw.js`** (ex. `amenhub-v2`) pour que les téléphones récupèrent la nouvelle version.

## Structure
```
index.html              page unique
manifest.webmanifest    infos d'installation
sw.js                   cache hors ligne
css/app.css             design (palette beige)
js/config.js            ← tes réglages
js/app.js               connexion, navigation, rôles
js/db.js                accès Supabase + cache local
js/dates.js             analyse des RDV en français
js/ics.js               création des événements calendrier
js/net.js               calculs IPv4 / VLSM
js/modules/*.js         un fichier par écran
supabase/schema.sql     tables, rôles, sécurité RLS
```

## Sécurité, en bref
- RLS activé sur toutes les tables. `items` (tes données privées) est accessible **seulement** par toi en tant qu'admin.
- `ideas` : lecture par les membres, création en son nom, statut et commentaire modifiables **uniquement** par l'admin (trigger `ideas_guard`).
- Rôles non modifiables depuis l'appli (pas de politique d'écriture sur `profiles`).
- Inscriptions publiques désactivées : seuls les comptes que tu crées peuvent se connecter.
- Tout contenu affiché est échappé (anti-XSS) et seuls les liens `http(s)` sont cliquables.
