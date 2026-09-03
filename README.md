# MyCabine — Guide de mise en ligne (pas à pas)

Ce projet est une vraie application web (Next.js) prête à être déployée sur internet.
Compte environ 45-60 minutes la première fois, en suivant chaque étape dans l'ordre.

---

## Ce dont tu as besoin avant de commencer

- Un ordinateur avec **Node.js** installé (version 18 ou plus). Si tu ne l'as pas :
  télécharge-le sur https://nodejs.org (choisis la version "LTS").
- Un compte **Google** (pour Firebase).
- Un compte **GitHub** (gratuit) — https://github.com/signup
- Un compte **Vercel** (gratuit, tu peux te connecter directement avec GitHub) — https://vercel.com
- Ton **lien de paiement Wave marchand** (récupérable dans ton application Wave, section "Recevoir de l'argent" ou "Mon lien").
- Ton compte **Telegram** installé sur ton téléphone.

---

## Étape 1 — Créer le projet Firebase (base de données + connexion admin)

1. Va sur https://console.firebase.google.com et clique **"Ajouter un projet"**.
2. Nomme-le par exemple `mycabine` et suis les étapes (tu peux désactiver Google Analytics, pas nécessaire).
3. Une fois le projet créé, dans le menu de gauche : **Build > Firestore Database** → **Créer une base de données** → choisis **"Mode production"** → sélectionne une région proche (ex: `eur3` ou `europe-west`) → Activer.
4. Toujours dans Firestore, va dans l'onglet **"Règles"** et remplace tout le contenu par celui du fichier `firestore.rules` fourni dans ce projet. Clique **Publier**.
5. Dans le menu de gauche : **Build > Authentication** → **Get started** → active la méthode **"E-mail/Mot de passe"**.
6. Toujours dans Authentication, onglet **"Users"** → **Add user** → entre ton email et un mot de passe solide. C'est ton compte admin — garde-le précieusement.
7. Retourne à la page d'accueil du projet (icône engrenage > **Paramètres du projet**) → en bas, section **"Vos applications"** → clique l'icône `</>` (Web) → donne un nom (ex: `mycabine-web`) → **Enregistrer l'application**.
8. Firebase t'affiche un bloc `firebaseConfig` avec des valeurs (`apiKey`, `authDomain`, etc.). **Garde cette page ouverte**, tu en as besoin à l'étape 4.

---

## Étape 2 — Créer le bot Telegram (notifications gratuites)

1. Ouvre Telegram, cherche **@BotFather** et démarre une conversation.
2. Envoie `/newbot`, donne un nom (ex: `MyCabine Notifs`) puis un identifiant unique se terminant par `bot` (ex: `mycabine_notify_bot`).
3. BotFather te donne un **token** du type `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`. **Copie-le.**
4. Cherche ton bot dans Telegram (par son nom) et clique **Démarrer** / envoie-lui n'importe quel message (ex: "salut").
5. Dans ton navigateur, ouvre cette adresse en remplaçant `TON_TOKEN` :
   `https://api.telegram.org/botTON_TOKEN/getUpdates`
6. Tu verras un texte JSON contenant `"chat":{"id":123456789,...}` — ce nombre est ton **chat_id**. Note-le.

---

## Étape 3 — Récupérer le projet sur ton ordinateur

1. Télécharge le fichier `mycabine-web.zip` que je t'ai fourni et décompresse-le.
2. Ouvre un terminal dans ce dossier, puis installe les dépendances :
   ```
   npm install
   ```

---

## Étape 4 — Configurer les variables d'environnement

1. Dans le dossier du projet, copie le fichier `.env.local.example` et renomme la copie en `.env.local`.
2. Ouvre `.env.local` et remplis chaque ligne :
   - Les 6 valeurs `NEXT_PUBLIC_FIREBASE_...` viennent du bloc `firebaseConfig` de l'étape 1.8.
   - `TELEGRAM_BOT_TOKEN` = le token de l'étape 2.3.
   - `TELEGRAM_CHAT_ID` = le chat_id de l'étape 2.6.
3. Enregistre le fichier. **Ne le partage jamais et ne le mets jamais sur GitHub** (il est déjà exclu via `.gitignore`).

---

## Étape 5 — Tester en local

Dans le terminal, toujours dans le dossier du projet :
```
npm run dev
```
Ouvre http://localhost:3000 dans ton navigateur. Le site doit s'afficher. Teste une "Transfert d'unité" fictive, puis va dans "Espace admin" et connecte-toi avec l'email/mot de passe créés à l'étape 1.6 — tu dois voir la demande apparaître, et recevoir un message sur Telegram.

Si quelque chose ne marche pas, vérifie que toutes les valeurs dans `.env.local` sont correctes (pas d'espace en trop, pas de guillemets).

---

## Étape 6 — Mettre le code sur GitHub

1. Crée un nouveau dépôt sur https://github.com/new (ex: `mycabine-web`), reste en **Private** si tu préfères.
2. Dans le terminal, toujours dans le dossier du projet :
   ```
   git init
   git add .
   git commit -m "MyCabine - premier déploiement"
   git branch -M main
   git remote add origin https://github.com/TON_NOM_UTILISATEUR/mycabine-web.git
   git push -u origin main
   ```

---

## Étape 7 — Déployer (Vercel ou Netlify)

### Option A — Vercel (recommandé, le plus simple pour Next.js)
1. Va sur https://vercel.com/new et connecte-toi avec ton compte GitHub.
2. Clique **Import** à côté du dépôt `mycabine-web`.
3. Dans la section **Environment Variables**, ajoute exactement les mêmes clés que dans ton `.env.local` (une par une : nom + valeur).
4. Clique **Deploy**. Après 1-2 minutes, tu obtiens une adresse du type `https://mycabine-web.vercel.app`.

### Option B — Netlify
Netlify peut aussi héberger ce projet Next.js, mais demande un réglage en plus :
1. Va sur https://app.netlify.com → **Add new site > Import an existing project**.
2. Choisis GitHub, puis le dépôt `mycabine-web`.
3. Dans **Build settings**, vérifie que :
   - **Build command** = `npm run build`
   - **Publish directory** = laisse le champ que Netlify propose automatiquement (il détecte Next.js et installe le plugin `@netlify/plugin-nextjs` tout seul — ne le supprime pas s'il apparaît).
4. Dans **Environment variables** (accessible aussi après coup dans **Site configuration > Environment variables**), ajoute les mêmes 8 clés que dans `.env.local`.
5. Clique **Deploy site**. Netlify te donne une adresse du type `https://mycabine-web.netlify.app`.

Si le build Netlify échoue avec une erreur liée aux "API routes" ou au "runtime", va dans **Site configuration > Build & deploy > Environment** et vérifie que le plugin Next.js (`@netlify/plugin-nextjs`) est bien listé/activé — c'est lui qui permet à `pages/api/notify.js` de fonctionner sur Netlify.

### Nom de domaine personnalisé (optionnel)
Sur Vercel : **Project > Settings > Domains**. Sur Netlify : **Site configuration > Domain management**. Dans les deux cas, ajoute ton domaine et suis les instructions DNS affichées.

---

## Étape 8 — Configurer l'application elle-même

1. Ouvre ton site en ligne, va dans **Espace admin**, connecte-toi.
2. Onglet **Paramètres** :
   - Colle ton **lien Wave marchand**.
   - Renseigne tes **numéros de réception** par opérateur.
   - Ajuste le **catalogue de pass** si les prix ont changé.
3. Enregistre.

Ton site est maintenant pleinement fonctionnel : les clients peuvent commander, tu reçois une notification Telegram instantanée, et tu gères tout depuis l'espace admin.

---

## Limites importantes à connaître

- **Paiement** : le lien Wave généré ouvre bien une vraie page de paiement Wave, mais Wave ne préremplit le montant que si ton lien marchand le permet — teste-le une fois toi-même pour vérifier.
- **Confirmation automatique** : il n'existe pas d'API publique Wave pour confirmer automatiquement qu'un paiement a été reçu. Tu dois toujours vérifier manuellement sur ton compte Wave avant de traiter la commande (comme convenu dans le fonctionnement de l'appli).
- **Coût** : Firebase (Firestore + Authentication) et Vercel restent gratuits pour ce volume d'usage. Si le site devient très populaire, Firebase peut demander de passer sur un plan payant à l'usage — mais les seuils gratuits sont larges pour démarrer.
- Si tu veux ajouter un deuxième administrateur plus tard, retourne dans Firebase Authentication > Users > Add user.
