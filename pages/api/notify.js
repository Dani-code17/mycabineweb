// Compteur in-memory pour limiter le spam (anti-abus, simple).
// Note : sur une infra serverless multi-instances, ce compteur est par instance,
// ce qui reste une protection raisonnable pour ce volume.
const MAX_PER_MINUTE = 15;
const WINDOW_MS = 60 * 1000;
const hits = new Map(); // ip -> [timestamp, ...]

function clean(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  hits.set(ip, arr);
  return arr;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'inconnu').split(',')[0].trim();
  const recent = clean(ip);
  if (recent.length >= MAX_PER_MINUTE) {
    return res.status(429).json({ error: 'Trop de requêtes. Réessayez plus tard.' });
  }
  recent.push(Date.now());

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message manquant' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: 'message trop long' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    // Pas configuré : on ne bloque pas la commande du client, on informe juste.
    return res.status(200).json({ skipped: true, reason: 'Telegram non configuré' });
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    const data = await r.json();
    if (!data.ok) {
      return res.status(502).json({ error: data.description || 'Erreur Telegram' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur réseau vers Telegram' });
  }
}
