# MyCabine — Boutique de pass mobiles avec back-office et notifications instantanées

> Application **Next.js** permettant à un revendeur de pass télécoms (Orange, MTN, Moov, Wave)
> de recevoir des demandes en ligne, de les encaisser via un lien de paiement, et d'être
> **notifié en temps réel sur Telegram**.
> *Projet client — conçu, développé et déployé.*

**🇫🇷 Français** · [🇬🇧 English](#-english)

---

## Le problème

Revendre des pass internet, d'appel et de SMS depuis WhatsApp, c'est : des commandes noyées
dans les conversations, des transferts d'argent à vérifier à la main, et un catalogue de prix
qu'il faut répéter à chaque client. **MyCabine** transforme cette activité en boutique
autonome, sans embaucher de serveur.

## Fonctionnalités

### Côté client (public)
- **Catalogue de pass** par opérateur (Orange, MTN, Moov, Wave) et par type
  (**Internet**, **Appel**, **SMS**), avec durée et prix.
- **Formulaire de demande** : choix du pass, numéro à créditer, coordonnées.
- **Paiement par lien Wave marchand**, puis déclaration du paiement par le client
  (statut `paiement_declare`) — la confirmation reste manuelle côté commerçant, faute d'API
  publique Wave.
- **Contact WhatsApp** direct en complément.

### Côté admin (`Espace admin`)
- **Authentification Firebase** (email / mot de passe) réservée à une adresse autorisée.
- **File de demandes en temps réel** (`onSnapshot`) : nouvelle demande → statut mis à jour
  instantanément, sans rafraîchir la page.
- **Gestion du catalogue** : opérateurs, pass, prix, durée.
- **Paramètres** : lien Wave marchand, numéros de réception par opérateur.
- **Notifications Telegram** : chaque demande déclenche un message via une route API
  serverless (`pages/api/notify.js`), avec **limitation de débit** (15 messages/minute/IP).

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | **Next.js 14** (pages router, route API serverless) |
| UI | React 18 + **TailwindCSS** + lucide-react |
| Base de données | **Firebase Firestore** (temps réel) |
| Auth | **Firebase Authentication** |
| Notifications | **Telegram Bot API** via `pages/api/notify.js` |
| Déploiement | Vercel (recommandé) ou Netlify + plugin Next.js |

## Architecture

```
mycabineweb/
├── pages/
│   ├── index.js         Boutique (public) + Espace admin dans la même app, selon l'état d'auth
│   └── api/notify.js    Route serverless : proxy Telegram + anti-spam (15 req/min/IP)
├── lib/firebase.js      Initialisation Firebase (config par variables d'environnement)
├── firestore.rules      Règles de sécurité Firestore (voir ci-dessous)
└── styles/              Tailwind
```

### Modèle Firestore

| Collection | Écriture | Lecture |
|---|---|---|
| `settings/main` | création publique unique, puis **admin** | publique (catalogue, lien Wave) |
| `requests/{id}` | **création publique** ; le client ne peut modifier **que** `status → paiement_declare` | **admin uniquement** |
| `links/{id}` | création publique | **admin uniquement** |

### Sécurité — un choix assumé

Les règles `firestore.rules` suivent le principe du **moindre privilège** :

- l'admin est identifié par une **adresse email exacte** (`request.auth.token.email`) ;
- les demandes sont **lisibles uniquement par l'admin** — un client ne peut pas lire les
  commandes des autres, seules ses propres écritures lui sont permises ;
- la mise à jour client est restreinte par un `diff().affectedKeys()` : **seul le champ
  `status`**, et **seulement** vers `paiement_declare`, et **jamais** après `traite` ;
- `delete` est refusé partout : pas de perte de données accidentelle.

## Démarrage rapide

```bash
npm install
cp .env.local.example .env.local   # 6 clés Firebase + 2 clés Telegram
npm run dev                        # http://localhost:3000
```

### Variables d'environnement

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._PROJECT_ID`, `..._STORAGE_BUCKET`, `..._MESSAGING_SENDER_ID`, `..._APP_ID` | Console Firebase → Paramètres du projet → Vos applications (Web) |
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `TELEGRAM_CHAT_ID` | `https://api.telegram.org/bot<TOKEN>/getUpdates` |

> `.env.local` est déjà exclu par `.gitignore`. Les clés `NEXT_PUBLIC_*` sont publiques par
> nature (embarquées dans le bundle) — d'où l'importance des règles Firestore ; les clés
> Telegram, elles, restent **strictement côté serveur**.

## Déploiement sur Vercel

1. **Import** du dépôt sur https://vercel.com/new.
2. Ajouter les **8 variables d'environnement** (mêmes clés que `.env.local`).
3. **Deploy** → `https://mycabine-web.vercel.app`.
4. Dernière étape : se connecter à l'Espace admin et renseigner le lien Wave, les numéros de
   réception et le catalogue.

*Netlify fonctionne aussi*, à condition de conserver le plugin `@netlify/plugin-nextjs`
(détecté automatiquement) pour que `pages/api/notify.js` s'exécute.

## Limites connues (documentées volontairement)

- **Confirmation de paiement** : Wave ne propose pas d'API publique de vérification ; la
  confirmation reste **manuelle** dans l'espace admin.
- **Anti-spam** : le compteur de `notify.js` est en mémoire, donc **par instance serverless**.
  Suffisant pour ce volume, à remplacer par un stockage partagé si le trafic explose.
- **Back-office** : un seul administrateur (adresse codée dans les règles Firestore) ;
  en ajouter un demande de modifier `firestore.rules`.

---

## 🇬🇧 English

**MyCabine** is a **Next.js** storefront that lets a mobile-data reseller (Orange, MTN, Moov,
Wave) take online orders, collect payment through a Wave merchant link, and get **instant
Telegram notifications** — no backend to operate.
*Client project — designed, built and deployed.*

- **Public catalog** of internet / call / SMS passes per operator, plus an order form.
- **Admin area** behind Firebase Auth: real-time order queue (`onSnapshot`), pass catalog and
  payment settings.
- **Serverless Telegram proxy** (`pages/api/notify.js`) with per-IP rate limiting
  (15 messages/minute).
- **Firestore security rules** enforce least privilege: orders are readable **only** by the
  admin; a client may update **only** the `status` field, **only** to `paiement_declare`,
  **never** once the order is `traite`; deletes are denied everywhere.

**Stack:** Next.js 14 · React 18 · TailwindCSS · Firebase Firestore + Auth · Telegram Bot API ·
Vercel.

```bash
npm install
cp .env.local.example .env.local   # 6 Firebase keys + 2 Telegram keys
npm run dev
```

**Known limitation:** Wave exposes no public payment-verification API, so payment
confirmation remains a manual admin step.

**Author:** Yeo Daniel — [github.com/Dani-code17](https://github.com/Dani-code17)
