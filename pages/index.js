import { useState, useEffect } from 'react';
import {
  doc, getDoc, setDoc, addDoc, collection, onSnapshot, updateDoc, query, orderBy,
} from 'firebase/firestore';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  Smartphone, ArrowLeftRight, Link2, ArrowLeft, Lock, Check, Copy,
  Wifi, Phone, MessageSquare, MessageCircle, ChevronRight, Clock, CheckCircle2, Plus, Trash2, LogOut,
} from 'lucide-react';
import { db, auth } from '../lib/firebase';

const WHATSAPP_LINK = 'https://wa.me/2250556382763';

const OPERATORS = {
  orange: { label: 'Orange', color: '#FF6600', text: '#FFFFFF', initial: 'O' },
  mtn: { label: 'MTN', color: '#FFCB05', text: '#12102B', initial: 'M' },
  moov: { label: 'Moov', color: '#0033A0', text: '#FFFFFF', initial: 'M' },
  wave: { label: 'Wave', color: '#1BA7E8', text: '#FFFFFF', initial: 'W' },
};

const PASS_TYPES = {
  internet: { label: 'Internet', icon: Wifi },
  appel: { label: 'Appel', icon: Phone },
  sms: { label: 'SMS', icon: MessageSquare },
};

const DEFAULT_CATALOG = {
  orange: {
    internet: [
      { id: 'or-i-1', label: 'Pass Jour 40 Mo', duree: '1 jour', price: 100 },
      { id: 'or-i-2', label: 'Pass Jour 250 Mo', duree: '1 jour', price: 300 },
      { id: 'or-i-3', label: 'Pass Nuit illimité (0h-6h)', duree: '1 jour', price: 200 },
      { id: 'or-i-4', label: 'Pass Semaine 1 Go', duree: '7 jours', price: 600 },
      { id: 'or-i-5', label: 'Pass Mois 10 Go', duree: '30 jours', price: 5000 },
      { id: 'or-i-6', label: 'Pass Mois Max 15 Go', duree: '30 jours', price: 10000 },
    ],
    appel: [
      { id: 'or-a-1', label: '60 min tous réseaux', duree: '1 jour', price: 500 },
      { id: 'or-a-2', label: 'Illimité vers Orange', duree: '1 jour', price: 1000 },
      { id: 'or-a-3', label: 'Pass Mix Appel + SMS + Data', duree: '7 jours', price: 2000 },
    ],
    sms: [
      { id: 'or-s-1', label: '50 SMS tous réseaux', duree: '1 jour', price: 100 },
      { id: 'or-s-2', label: 'SMS illimité', duree: '1 jour', price: 500 },
    ],
  },
  mtn: {
    internet: [
      { id: 'mt-i-1', label: 'Pack 220 Mo', duree: '2 jours', price: 200 },
      { id: 'mt-i-2', label: 'Pack 450 Mo', duree: '3 jours', price: 400 },
      { id: 'mt-i-3', label: 'Pack 750 Mo', duree: '3 jours', price: 500 },
      { id: 'mt-i-4', label: 'Pack 1,5 Go', duree: '5 jours', price: 1000 },
      { id: 'mt-i-5', label: 'Pack 2,2 Go', duree: '10 jours', price: 1500 },
      { id: 'mt-i-6', label: 'Pack Mois ~6 Go', duree: '30 jours', price: 5000 },
    ],
    appel: [
      { id: 'mt-a-1', label: 'Pack Yello 60 min', duree: '1 jour', price: 500 },
      { id: 'mt-a-2', label: 'Illimité vers MTN', duree: '1 jour', price: 1000 },
    ],
    sms: [
      { id: 'mt-s-1', label: '100 SMS', duree: '1 jour', price: 100 },
    ],
  },
  moov: {
    internet: [
      { id: 'mo-i-1', label: 'Pass Jour 300 Mo', duree: '1 jour', price: 100 },
      { id: 'mo-i-2', label: 'Pass Semaine 2 Go', duree: '7 jours', price: 1000 },
      { id: 'mo-i-3', label: 'Pass Mois 7 Go', duree: '30 jours', price: 5000 },
    ],
    appel: [
      { id: 'mo-a-1', label: '60 min tous réseaux', duree: '1 jour', price: 500 },
      { id: 'mo-a-2', label: 'Illimité vers Moov', duree: '1 jour', price: 1000 },
    ],
    sms: [
      { id: 'mo-s-1', label: '50 SMS', duree: '1 jour', price: 100 },
    ],
  },
};

const DEFAULT_SETTINGS = {
  waveBaseLink: '',
  receivingNumbers: { orange: '', mtn: '', moov: '', wave: '' },
  catalog: DEFAULT_CATALOG,
};

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
function genRef() { return 'MC-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 4).toUpperCase(); }

// Seul ce compte (adresse e-mail exacte) a accès à l'espace admin.
// À renseigner dans le fichier .env.local : NEXT_PUBLIC_ADMIN_EMAIL=...
const ALLOWED_ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();
function isAdmin(user) {
  return !!user && !!ALLOWED_ADMIN_EMAIL && (user.email || '').trim().toLowerCase() === ALLOWED_ADMIN_EMAIL;
}

function waveLink(base, amount) {
  if (!base) return null;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}amount=${amount}`;
}

async function notifyTelegram(message) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  } catch (e) {
    // On ne bloque jamais la commande du client si la notification échoue.
  }
}

export default function MyCabinePage() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [adminUser, setAdminUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [links, setLinks] = useState([]);
  const [view, setView] = useState('home');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'main'));
        if (snap.exists()) {
          const s = snap.data();
          setSettings({
            ...DEFAULT_SETTINGS,
            ...s,
            receivingNumbers: { ...DEFAULT_SETTINGS.receivingNumbers, ...(s.receivingNumbers || {}) },
            catalog: s.catalog || DEFAULT_CATALOG,
          });
        } else {
          // Crée les réglages par défaut si absents (première visite).
          await setDoc(doc(db, 'settings', 'main'), DEFAULT_SETTINGS);
        }
      } catch (e) {
        // En cas d'erreur (réseau, règle...), on garde les valeurs par défaut
        // et on continue : la page doit toujours s'afficher, jamais rester bloquée.
      }
      setReady(true);
    })();
    const unsub = onAuthStateChanged(auth, (user) => setAdminUser(user));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin(adminUser)) { setRequests([]); setLinks([]); return; }
    const unsubReq = onSnapshot(query(collection(db, 'requests'), orderBy('createdAt', 'desc')), (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubLinks = onSnapshot(query(collection(db, 'links'), orderBy('createdAt', 'desc')), (snap) => {
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubReq(); unsubLinks(); };
  }, [adminUser]);

  function notify(msg) { setToast(msg); setTimeout(() => setToast(null), 2600); }

  async function persistSettings(next) {
    setSettings(next);
    await setDoc(doc(db, 'settings', 'main'), next, { merge: true });
  }

  if (!ready) {
    return (
      <div style={{ background: '#12102B' }} className="min-h-screen flex items-center justify-center">
        <div className="w-9 h-9 border-4 border-[#29D3C7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ background: '#F7F5FF', color: '#12102B' }} className="min-h-screen">
      <TopBar view={view} setView={setView} />

      <main className="max-w-3xl mx-auto px-4 pb-20">
        {view === 'home' && <Home setView={setView} />}

        {view === 'unit' && (
          <UnitTransfer
            settings={settings}
            onSubmit={async (data) => {
              const ref = genRef();
              const reqDoc = { refCode: ref, type: 'unite', ...data, status: 'nouveau', createdAt: Date.now() };
              const docRef = await addDoc(collection(db, 'requests'), reqDoc);
              notifyTelegram(
                `🆕 <b>Nouvelle demande d'unité</b>\nRéf : ${ref}\nOpérateur : ${OPERATORS[data.operator].label}\nPass : ${data.passLabel}\nNuméro : ${data.recipient}\nMontant : ${fmt(data.price)}`
              );
              return { ref, docId: docRef.id };
            }}
            onMarkPaid={async (docId) => {
              await updateDoc(doc(db, 'requests', docId), { status: 'paiement_declare' });
            }}
            back={() => setView('home')}
          />
        )}

        {view === 'money' && (
          <MoneyTransfer
            settings={settings}
            onSubmit={async (data) => {
              const ref = genRef();
              const reqDoc = { refCode: ref, type: 'argent', ...data, status: 'en_attente', createdAt: Date.now() };
              const docRef = await addDoc(collection(db, 'requests'), reqDoc);
              notifyTelegram(
                `🆕 <b>Nouveau transfert d'argent</b>\nRéf : ${ref}\nDe : ${OPERATORS[data.from].label} (${data.sourceNumber})\nVers : ${OPERATORS[data.to].label} (${data.destNumber})\nMontant : ${fmt(data.amount)}`
              );
              return { ref, docId: docRef.id };
            }}
            onMarkPaid={async (docId) => {
              await updateDoc(doc(db, 'requests', docId), { status: 'paiement_declare' });
            }}
            back={() => setView('home')}
          />
        )}

        {view === 'link' && (
          <PaymentLinkView
            settings={settings}
            onCreate={async (data) => {
              const rec = { refCode: genRef(), ...data, createdAt: Date.now() };
              await addDoc(collection(db, 'links'), rec);
              return rec;
            }}
            back={() => setView('home')}
            notify={notify}
          />
        )}

        {view === 'admin-login' && (
          <AdminLogin
            onSuccess={() => setView('admin')}
            back={() => setView('home')}
          />
        )}

        {view === 'admin' && isAdmin(adminUser) && (
          <AdminDashboard
            settings={settings}
            requests={requests}
            links={links}
            saveSettings={persistSettings}
            updateStatus={async (id, status) => updateDoc(doc(db, 'requests', id), { status })}
            onLogout={async () => { await signOut(auth); setView('home'); }}
            back={() => setView('home')}
          />
        )}
        {view === 'admin' && !isAdmin(adminUser) && (
          <AdminLogin onSuccess={() => setView('admin')} back={() => setView('home')} />
        )}
      </main>

      {toast && (
        <div style={{ background: '#12102B', color: '#F7F5FF' }} className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-xl text-sm font-medium z-50 flex items-center gap-2 anim-in">
          <Check size={16} /> {toast}
        </div>
      )}

      <WhatsAppFloat />
    </div>
  );
}

function WhatsAppFloat() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacter le service client sur WhatsApp"
      className="fixed bottom-6 right-5 z-50 wa-float"
    >
      <span className="wa-ring" />
      <span style={{ background: '#25D366' }} className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl">
        <MessageCircle size={26} color="#FFFFFF" strokeWidth={2.2} />
      </span>
    </a>
  );
}

function SignalBars() {
  return (
    <span className="inline-flex items-end h-3">
      <span className="signal-bar" style={{ height: '4px', animationDelay: '0s' }} />
      <span className="signal-bar" style={{ height: '7px', animationDelay: '0.15s' }} />
      <span className="signal-bar" style={{ height: '10px', animationDelay: '0.3s' }} />
      <span className="signal-bar" style={{ height: '13px', animationDelay: '0.45s' }} />
    </span>
  );
}

function TopBar({ view, setView }) {
  return (
    <header style={{ background: '#12102B' }} className="sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={() => setView('home')} className="flex items-center gap-2">
          <SignalBars />
          <span className="logo3d text-base">MyCabine</span>
        </button>
        {view !== 'home' && (
          <button onClick={() => setView('home')} style={{ color: '#C9C4E8' }} className="text-xs font-medium flex items-center gap-1">
            <ArrowLeft size={13} /> Accueil
          </button>
        )}
      </div>
    </header>
  );
}

function Home({ setView }) {
  return (
    <div className="pt-10">
      <div className="text-center mb-10">
        <div style={{ perspective: '600px' }} className="mb-4">
          <span className="logo3d text-5xl">MyCabine</span>
        </div>
        <p style={{ color: '#5C5580' }} className="text-sm max-w-sm mx-auto">
          Unités internet, appel, SMS et transferts d'argent entre Orange, MTN, Moov &amp; Wave — sans bouger de chez vous.
        </p>
      </div>

      <div className="space-y-3">
        <OptionCard icon={Smartphone} title="Transfert d'unité" desc="Internet, appel ou SMS envoyé directement sur le numéro de votre choix — payable sur Wave." color="#6C4CF5" onClick={() => setView('unit')} />
        <OptionCard icon={ArrowLeftRight} title="Transfert d'argent" desc="Envoyez de l'argent d'un opérateur à un autre : Orange, MTN, Moov, Wave." color="#29D3C7" onClick={() => setView('money')} />
        <OptionCard icon={Link2} title="Créer un lien de paiement" desc="Générez un lien Wave prêt à partager pour vous faire payer un montant précis." color="#F5B700" onClick={() => setView('link')} />
        <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" style={{ background: '#FFFFFF', borderColor: '#E8E4FA' }} className="w-full border rounded-2xl p-4 flex items-center gap-4 text-left hover:shadow-md transition-shadow">
          <div style={{ background: '#25D366' }} className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
            <MessageCircle size={22} color="#FFFFFF" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: '#12102B' }}>Service client</p>
            <p className="text-xs mt-0.5" style={{ color: '#6E6790' }}>Une question, un souci ? Écrivez-nous directement sur WhatsApp.</p>
          </div>
          <ChevronRight size={18} style={{ color: '#B8B2DE' }} />
        </a>
      </div>

      <div className="text-center mt-12 mb-4">
        <p style={{ color: '#B8B2DE' }} className="text-xs">Créé par Yapoga Chrys Ezéchiel</p>
        <button onClick={() => setView('admin-login')} style={{ color: '#D7D2F0' }} className="text-[10px] mt-2 underline">Espace admin</button>
      </div>
    </div>
  );
}

function OptionCard({ icon: Icon, title, desc, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: '#FFFFFF', borderColor: '#E8E4FA' }} className="w-full border rounded-2xl p-4 flex items-center gap-4 text-left hover:shadow-md transition-shadow">
      <div style={{ background: color }} className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
        <Icon size={22} color="#FFFFFF" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: '#12102B' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: '#6E6790' }}>{desc}</p>
      </div>
      <ChevronRight size={18} style={{ color: '#B8B2DE' }} />
    </button>
  );
}

function OperatorPicker({ value, onChange, options }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(op => {
        const o = OPERATORS[op];
        const active = value === op;
        return (
          <button key={op} onClick={() => onChange(op)} style={{ borderColor: active ? o.color : '#E8E4FA', background: active ? o.color + '18' : '#FFFFFF' }} className="border rounded-xl p-3 flex flex-col items-center gap-1.5">
            <div style={{ background: o.color, color: o.text }} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">{o.initial}</div>
            <span className="text-xs font-semibold" style={{ color: '#12102B' }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6E6790' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm outline-none bg-white" style={{ borderColor: '#E8E4FA' }} />
    </div>
  );
}

function StepHeader({ step, total, title }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#9A93C4' }}>Étape {step} / {total}</p>
      <h2 className="font-display text-xl font-bold" style={{ color: '#12102B' }}>{title}</h2>
    </div>
  );
}

function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function ReceiptCard({ refCode, dateTime, rows, amount, onCopy }) {
  return (
    <div style={{ borderColor: '#E8E4FA', background: '#FFFFFF' }} className="border rounded-2xl overflow-hidden mb-4 text-left">
      <div style={{ background: '#12102B' }} className="px-4 py-3 flex items-center justify-between">
        <span className="logo3d text-sm">MyCabine</span>
        <span style={{ color: '#9A93C4' }} className="text-[10px] font-semibold uppercase tracking-wide">Reçu</span>
      </div>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="ref-ticket text-sm" style={{ color: '#12102B' }}>{refCode}</span>
          <button onClick={onCopy} style={{ color: '#6C4CF5' }} className="text-[11px] font-semibold flex items-center gap-1">
            <Copy size={12} /> Copier
          </button>
        </div>
        <p className="text-[11px] mb-3" style={{ color: '#9A93C4' }}>{dateTime}</p>
        <div style={{ borderTop: '1px dashed #E8E4FA', borderBottom: '1px dashed #E8E4FA' }} className="py-3 space-y-1.5 mb-3">
          {rows.map((r, i) => <Row key={i} label={r.label} value={r.value} bold={r.bold} />)}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#12102B' }}>Total</span>
          <span className="font-display text-xl font-bold" style={{ color: '#12102B' }}>{fmt(amount)}</span>
        </div>
      </div>
    </div>
  );
}

function PaidConfirmButton({ paid, onConfirm }) {
  if (paid) {
    return (
      <div style={{ background: '#E2F7EF', color: '#1B6B5C' }} className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2">
        <CheckCircle2 size={16} /> Paiement déclaré — vérification en cours
      </div>
    );
  }
  return (
    <button onClick={onConfirm} style={{ borderColor: '#29D3C7', color: '#12102B' }} className="w-full border-2 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2">
      <Check size={16} /> J'ai terminé le paiement
    </button>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: '#6E6790' }}>{label}</span>
      <span style={{ color: '#12102B', fontWeight: bold ? 700 : 600 }}>{value}</span>
    </div>
  );
}

function UnitTransfer({ settings, onSubmit, onMarkPaid, back }) {
  const [step, setStep] = useState(1);
  const [operator, setOperator] = useState(null);
  const [passType, setPassType] = useState(null);
  const [passId, setPassId] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [done, setDone] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [paid, setPaid] = useState(false);

  const catalog = settings.catalog || DEFAULT_CATALOG;
  const passes = operator && passType ? (catalog[operator]?.[passType] || []) : [];
  const selectedPass = passes.find(p => p.id === passId);

  async function confirm() {
    const result = await onSubmit({ operator, passType, passLabel: selectedPass.label, passDuree: selectedPass.duree, price: selectedPass.price, recipient });
    setDone(result);
    setCreatedAt(Date.now());
  }

  function copyReceipt() {
    const text = `MyCabine — Reçu\nRéf : ${done.ref}\nOpérateur : ${OPERATORS[operator].label}\nPass : ${selectedPass.label} (${selectedPass.duree})\nNuméro : ${recipient}\nMontant : ${fmt(selectedPass.price)}`;
    navigator.clipboard?.writeText(text);
  }

  if (done) {
    const link = waveLink(settings.waveBaseLink, selectedPass.price);
    return (
      <div className="pt-8 max-w-md mx-auto text-center">
        <div style={{ background: '#29D3C7' }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={30} color="#FFFFFF" />
        </div>
        <h1 className="font-display text-xl font-bold mb-1">Demande envoyée !</h1>
        <p className="text-sm mb-5" style={{ color: '#6E6790' }}>Payez sur Wave pour déclencher le transfert vers {recipient}.</p>

        <ReceiptCard
          refCode={done.ref}
          dateTime={fmtDateTime(createdAt)}
          onCopy={copyReceipt}
          amount={selectedPass.price}
          rows={[
            { label: 'Opérateur', value: OPERATORS[operator].label },
            { label: 'Pass', value: `${selectedPass.label} (${selectedPass.duree})` },
            { label: 'Numéro', value: recipient },
          ]}
        />

        <p className="text-xs mb-4" style={{ color: '#6E6790' }}>Important : indiquez la référence <span className="ref-ticket">{done.ref}</span> dans le message du paiement Wave.</p>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" style={{ background: '#1BA7E8', color: '#FFFFFF' }} className="block w-full py-3.5 rounded-full font-semibold text-sm mb-3">Payer {fmt(selectedPass.price)} sur Wave</a>
        ) : (
          <p className="text-xs p-3 rounded-lg mb-3" style={{ background: '#FFF3CD', color: '#7A5A00' }}>Le lien Wave n'est pas encore configuré.</p>
        )}
        <PaidConfirmButton paid={paid} onConfirm={() => { setPaid(true); onMarkPaid(done.docId); }} />
        <button onClick={back} className="text-xs mt-5" style={{ color: '#6E6790' }}>Retour à l'accueil</button>
      </div>
    );
  }

  return (
    <div className="pt-6 max-w-md mx-auto">
      <button onClick={step === 1 ? back : () => setStep(step - 1)} className="text-xs flex items-center gap-1 mb-4" style={{ color: '#6E6790' }}><ArrowLeft size={13} /> Retour</button>
      {step === 1 && (
        <>
          <StepHeader step={1} total={4} title="Choisissez l'opérateur" />
          <OperatorPicker value={operator} onChange={(v) => { setOperator(v); setPassType(null); setPassId(null); }} options={['orange', 'mtn', 'moov']} />
          <button disabled={!operator} onClick={() => setStep(2)} style={{ background: operator ? '#12102B' : '#E8E4FA', color: '#FFFFFF' }} className="w-full py-3 rounded-full text-sm font-semibold mt-6">Continuer</button>
        </>
      )}
      {step === 2 && (
        <>
          <StepHeader step={2} total={4} title="Quel type de pass ?" />
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PASS_TYPES).map(([id, t]) => {
              const Icon = t.icon; const active = passType === id;
              return (
                <button key={id} onClick={() => { setPassType(id); setPassId(null); }} style={{ borderColor: active ? '#6C4CF5' : '#E8E4FA', background: active ? '#6C4CF518' : '#FFFFFF' }} className="border rounded-xl p-3 flex flex-col items-center gap-1.5">
                  <Icon size={18} color={active ? '#6C4CF5' : '#6E6790'} />
                  <span className="text-xs font-semibold">{t.label}</span>
                </button>
              );
            })}
          </div>
          {passType && (
            <div className="mt-4 space-y-2">
              {passes.map(p => (
                <button key={p.id} onClick={() => setPassId(p.id)} style={{ borderColor: passId === p.id ? '#6C4CF5' : '#E8E4FA', background: passId === p.id ? '#6C4CF510' : '#FFFFFF' }} className="w-full border rounded-xl p-3 flex items-center justify-between text-left">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#12102B' }}>{p.label}</p>
                    <p className="text-[11px]" style={{ color: '#6E6790' }}>Valable {p.duree}</p>
                  </div>
                  <span className="ref-ticket text-xs" style={{ color: '#12102B' }}>{fmt(p.price)}</span>
                </button>
              ))}
            </div>
          )}
          <button disabled={!passId} onClick={() => setStep(3)} style={{ background: passId ? '#12102B' : '#E8E4FA', color: '#FFFFFF' }} className="w-full py-3 rounded-full text-sm font-semibold mt-6">Continuer</button>
        </>
      )}
      {step === 3 && (
        <>
          <StepHeader step={3} total={4} title="Numéro à recharger" />
          <Field label={`Numéro ${OPERATORS[operator].label}`} value={recipient} onChange={setRecipient} placeholder="07 00 00 00 00" />
          <button disabled={recipient.trim().length < 8} onClick={() => setStep(4)} style={{ background: recipient.trim().length >= 8 ? '#12102B' : '#E8E4FA', color: '#FFFFFF' }} className="w-full py-3 rounded-full text-sm font-semibold mt-6">Continuer</button>
        </>
      )}
      {step === 4 && selectedPass && (
        <>
          <StepHeader step={4} total={4} title="Vérifiez et confirmez" />
          <div style={{ borderColor: '#E8E4FA', background: '#FFFFFF' }} className="border rounded-xl p-4 space-y-1.5 mb-6">
            <Row label="Opérateur" value={OPERATORS[operator].label} />
            <Row label="Pass" value={`${selectedPass.label} (${selectedPass.duree})`} />
            <Row label="Numéro" value={recipient} />
            <Row label="Montant" value={fmt(selectedPass.price)} bold />
          </div>
          <button onClick={confirm} style={{ background: '#6C4CF5', color: '#FFFFFF' }} className="w-full py-3.5 rounded-full text-sm font-semibold">Confirmer la demande</button>
        </>
      )}
    </div>
  );
}

function MoneyTransfer({ settings, onSubmit, onMarkPaid, back }) {
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [sourceNumber, setSourceNumber] = useState('');
  const [destNumber, setDestNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [done, setDone] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [paid, setPaid] = useState(false);

  async function confirm() {
    const result = await onSubmit({ from, to, sourceNumber, destNumber, amount: Number(amount) });
    setDone(result);
    setCreatedAt(Date.now());
  }

  function copyReceipt() {
    const text = `MyCabine — Reçu\nRéf : ${done.ref}\nDe : ${OPERATORS[from].label} (${sourceNumber})\nVers : ${OPERATORS[to].label} (${destNumber})\nMontant : ${fmt(amount)}`;
    navigator.clipboard?.writeText(text);
  }

  if (done) {
    const receivingNumber = settings.receivingNumbers?.[from];
    return (
      <div className="pt-8 max-w-md mx-auto text-center">
        <div style={{ background: '#29D3C7' }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={30} color="#FFFFFF" />
        </div>
        <h1 className="font-display text-xl font-bold mb-1">Demande enregistrée !</h1>
        <p className="text-sm mb-5" style={{ color: '#6E6790' }}>Envoyez le montant depuis {OPERATORS[from].label}, le reste est pris en charge.</p>

        <ReceiptCard
          refCode={done.ref}
          dateTime={fmtDateTime(createdAt)}
          onCopy={copyReceipt}
          amount={amount}
          rows={[
            { label: 'De', value: `${OPERATORS[from].label} · ${sourceNumber}` },
            { label: 'Vers', value: `${OPERATORS[to].label} · ${destNumber}` },
          ]}
        />

        {(() => {
          const link = waveLink(settings.waveBaseLink, amount);
          return link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" style={{ background: '#1BA7E8', color: '#FFFFFF' }} className="block w-full py-3.5 rounded-full font-semibold text-sm mb-3">
              Payer {fmt(amount)} sur Wave
            </a>
          ) : (
            <p className="text-xs p-3 rounded-lg mb-3" style={{ background: '#FFF3CD', color: '#7A5A00' }}>Le lien Wave n'est pas encore configuré.</p>
          );
        })()}

        {receivingNumber && (
          <div style={{ background: '#F0EEFF' }} className="rounded-xl p-4 mb-4 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#6E6790' }}>Vous pouvez aussi envoyer {fmt(amount)} directement depuis votre compte {OPERATORS[from].label} au numéro</p>
            <p className="ref-ticket text-lg" style={{ color: '#12102B' }}>{receivingNumber}</p>
            <p className="text-[11px] mt-1" style={{ color: '#6E6790' }}>Mentionnez la référence <span className="ref-ticket">{done.ref}</span> si possible.</p>
          </div>
        )}
        <PaidConfirmButton paid={paid} onConfirm={() => { setPaid(true); onMarkPaid(done.docId); }} />
        <button onClick={back} className="text-xs mt-4" style={{ color: '#6E6790' }}>Retour à l'accueil</button>
      </div>
    );
  }

  return (
    <div className="pt-6 max-w-md mx-auto">
      <button onClick={step === 1 ? back : () => setStep(step - 1)} className="text-xs flex items-center gap-1 mb-4" style={{ color: '#6E6790' }}><ArrowLeft size={13} /> Retour</button>
      {step === 1 && (
        <>
          <StepHeader step={1} total={3} title="De quel compte ?" />
          <p className="text-xs mb-2" style={{ color: '#6E6790' }}>L'opérateur où se trouve l'argent aujourd'hui.</p>
          <OperatorPicker value={from} onChange={setFrom} options={['orange', 'mtn', 'moov', 'wave']} />
          <p className="text-xs mt-5 mb-2" style={{ color: '#6E6790' }}>Vers quel opérateur ?</p>
          <OperatorPicker value={to} onChange={setTo} options={['orange', 'mtn', 'moov', 'wave']} />
          <button disabled={!from || !to} onClick={() => setStep(2)} style={{ background: from && to ? '#12102B' : '#E8E4FA', color: '#FFFFFF' }} className="w-full py-3 rounded-full text-sm font-semibold mt-6">Continuer</button>
        </>
      )}
      {step === 2 && (
        <>
          <StepHeader step={2} total={3} title="Les numéros" />
          <div className="space-y-3">
            <Field label={`Votre numéro ${OPERATORS[from].label} (source)`} value={sourceNumber} onChange={setSourceNumber} placeholder="07 00 00 00 00" />
            <Field label={`Numéro ${OPERATORS[to].label} qui reçoit`} value={destNumber} onChange={setDestNumber} placeholder="05 00 00 00 00" />
            <Field label="Montant à transférer (FCFA)" value={amount} onChange={setAmount} placeholder="5000" type="number" />
          </div>
          <button disabled={sourceNumber.trim().length < 8 || destNumber.trim().length < 8 || !(Number(amount) > 0)} onClick={() => setStep(3)} style={{ background: (sourceNumber.trim().length >= 8 && destNumber.trim().length >= 8 && Number(amount) > 0) ? '#12102B' : '#E8E4FA', color: '#FFFFFF' }} className="w-full py-3 rounded-full text-sm font-semibold mt-6">Continuer</button>
        </>
      )}
      {step === 3 && (
        <>
          <StepHeader step={3} total={3} title="Vérifiez et confirmez" />
          <div style={{ borderColor: '#E8E4FA', background: '#FFFFFF' }} className="border rounded-xl p-4 space-y-1.5 mb-6">
            <Row label="De" value={`${OPERATORS[from].label} · ${sourceNumber}`} />
            <Row label="Vers" value={`${OPERATORS[to].label} · ${destNumber}`} />
            <Row label="Montant" value={fmt(amount)} bold />
          </div>
          <button onClick={confirm} style={{ background: '#29D3C7', color: '#12102B' }} className="w-full py-3.5 rounded-full text-sm font-bold">Confirmer la demande</button>
        </>
      )}
    </div>
  );
}

function PaymentLinkView({ settings, onCreate, back, notify }) {
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState(null);

  async function generate() {
    const link = waveLink(settings.waveBaseLink, amount);
    const rec = await onCreate({ amount: Number(amount), label: label.trim(), link });
    setCreated(rec);
  }

  function copy() {
    if (!created?.link) return;
    navigator.clipboard?.writeText(created.link);
    notify('Lien copié !');
  }

  return (
    <div className="pt-6 max-w-md mx-auto">
      <button onClick={back} className="text-xs flex items-center gap-1 mb-4" style={{ color: '#6E6790' }}><ArrowLeft size={13} /> Retour</button>
      <StepHeader step={1} total={1} title="Créer un lien de paiement" />
      {!settings.waveBaseLink && (
        <p className="text-xs p-3 rounded-lg mb-4" style={{ background: '#FFF3CD', color: '#7A5A00' }}>Aucun lien Wave configuré côté admin.</p>
      )}
      {!created ? (
        <>
          <div className="space-y-3 mb-6">
            <Field label="Montant (FCFA)" value={amount} onChange={setAmount} placeholder="10000" type="number" />
            <Field label="Description (optionnel)" value={label} onChange={setLabel} placeholder="Ex : Ebook Bac 2027" />
          </div>
          <button disabled={!(Number(amount) > 0)} onClick={generate} style={{ background: Number(amount) > 0 ? '#F5B700' : '#E8E4FA', color: '#12102B' }} className="w-full py-3.5 rounded-full text-sm font-bold">Générer le lien</button>
        </>
      ) : (
        <div>
          <div style={{ borderColor: '#E8E4FA', background: '#FFFFFF' }} className="border rounded-xl p-4 mb-4">
            {created.label && <p className="text-xs mb-1" style={{ color: '#6E6790' }}>{created.label}</p>}
            <p className="font-display text-2xl font-bold mb-2" style={{ color: '#12102B' }}>{fmt(created.amount)}</p>
            <p className="ref-ticket text-xs break-all" style={{ color: '#1BA7E8' }}>{created.link || '— lien Wave non configuré —'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={copy} style={{ borderColor: '#E8E4FA', color: '#12102B' }} className="flex-1 border py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5"><Copy size={14} /> Copier</button>
            <button onClick={() => setCreated(null)} style={{ background: '#12102B', color: '#FFFFFF' }} className="flex-1 py-3 rounded-full text-sm font-semibold">Nouveau lien</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminLogin({ onSuccess, back }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(''); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!isAdmin(cred.user)) {
        setError('Ce compte n’est pas autorisé à accéder à l’espace admin.');
        await signOut(auth);
        return;
      }
      onSuccess();
    } catch (e) {
      setError('Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pt-16 max-w-xs mx-auto text-center">
      <button onClick={back} className="text-xs flex items-center gap-1 mb-6" style={{ color: '#6E6790' }}><ArrowLeft size={13} /> Retour</button>
      <div style={{ background: '#12102B' }} className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
        <Lock size={22} color="#3FE8DB" />
      </div>
      <h1 className="font-display text-lg font-bold mb-1">Espace admin</h1>
      <p className="text-xs mb-5" style={{ color: '#6E6790' }}>Connectez-vous avec votre compte administrateur.</p>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full border rounded-lg px-3 py-2.5 text-sm text-center outline-none mb-3" style={{ borderColor: '#E8E4FA' }} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" className="w-full border rounded-lg px-3 py-2.5 text-sm text-center outline-none mb-3" style={{ borderColor: '#E8E4FA' }} />
      {error && <p className="text-xs mb-3" style={{ color: '#C0392B' }}>{error}</p>}
      <button onClick={submit} disabled={loading} style={{ background: '#6C4CF5', color: '#FFFFFF' }} className="w-full py-3 rounded-full text-sm font-semibold">{loading ? 'Connexion…' : 'Entrer'}</button>
    </div>
  );
}

function AdminDashboard({ settings, requests, links, saveSettings, updateStatus, onLogout, back }) {
  const [tab, setTab] = useState('unite');
  const uniteReqs = requests.filter(r => r.type === 'unite');
  const argentReqs = requests.filter(r => r.type === 'argent');

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={back} className="text-xs flex items-center gap-1" style={{ color: '#6E6790' }}><ArrowLeft size={13} /> Accueil</button>
        <button onClick={onLogout} className="text-xs flex items-center gap-1" style={{ color: '#6E6790' }}><LogOut size={13} /> Déconnexion</button>
      </div>
      <h1 className="font-display text-2xl font-bold mb-5" style={{ color: '#12102B' }}>Espace admin</h1>

      <div className="flex gap-1 mb-5 border-b overflow-x-auto" style={{ borderColor: '#E8E4FA' }}>
        <TabBtn active={tab === 'unite'} onClick={() => setTab('unite')}>Unités ({uniteReqs.filter(r => r.status === 'nouveau').length})</TabBtn>
        <TabBtn active={tab === 'argent'} onClick={() => setTab('argent')}>Argent ({argentReqs.filter(r => r.status === 'en_attente').length})</TabBtn>
        <TabBtn active={tab === 'liens'} onClick={() => setTab('liens')}>Liens</TabBtn>
        <TabBtn active={tab === 'params'} onClick={() => setTab('params')}>Paramètres</TabBtn>
      </div>

      {tab === 'unite' && (
        <div className="space-y-3">
          {uniteReqs.length === 0 && <EmptyAdmin text="Aucune demande d'unité pour l'instant." />}
          {uniteReqs.map(r => (
            <div key={r.id} style={{ borderColor: '#E8E4FA', background: '#FFFFFF' }} className="border rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="ref-ticket text-xs">{r.refCode}</span>
                <StatusPill status={r.status} labels={{ nouveau: 'Nouveau', paiement_declare: 'Paiement déclaré', traite: 'Traité' }} />
              </div>
              <Row label="Opérateur" value={OPERATORS[r.operator].label} />
              <Row label="Pass" value={r.passLabel} />
              <Row label="Numéro" value={r.recipient} />
              <Row label="Montant" value={fmt(r.price)} bold />
              {r.status !== 'traite' && (
                <button onClick={() => updateStatus(r.id, 'traite')} style={{ background: '#12102B', color: '#FFFFFF' }} className="w-full py-2 rounded-lg text-xs font-semibold mt-3">Marquer comme traité</button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'argent' && (
        <div className="space-y-3">
          {argentReqs.length === 0 && <EmptyAdmin text="Aucune demande de transfert d'argent." />}
          {argentReqs.map(r => (
            <div key={r.id} style={{ borderColor: '#E8E4FA', background: '#FFFFFF' }} className="border rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="ref-ticket text-xs">{r.refCode}</span>
                <StatusPill status={r.status} labels={{ en_attente: 'En attente', paiement_declare: 'Paiement déclaré', traite: 'Traité' }} />
              </div>
              <Row label="De" value={`${OPERATORS[r.from].label} · ${r.sourceNumber}`} />
              <Row label="Vers" value={`${OPERATORS[r.to].label} · ${r.destNumber}`} />
              <Row label="Montant" value={fmt(r.amount)} bold />
              {r.status !== 'traite' && (
                <button onClick={() => updateStatus(r.id, 'traite')} style={{ background: '#12102B', color: '#FFFFFF' }} className="w-full py-2 rounded-lg text-xs font-semibold mt-3">Marquer comme traité</button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'liens' && (
        <div className="space-y-3">
          {links.length === 0 && <EmptyAdmin text="Aucun lien créé pour l'instant." />}
          {links.map(l => (
            <div key={l.id} style={{ borderColor: '#E8E4FA', background: '#FFFFFF' }} className="border rounded-xl p-4">
              {l.label && <p className="text-xs mb-1" style={{ color: '#6E6790' }}>{l.label}</p>}
              <p className="font-display text-lg font-bold mb-1">{fmt(l.amount)}</p>
              <p className="ref-ticket text-[11px] break-all" style={{ color: '#1BA7E8' }}>{l.link}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'params' && <SettingsPanel settings={settings} saveSettings={saveSettings} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ borderColor: active ? '#6C4CF5' : 'transparent', color: active ? '#12102B' : '#9A93C4' }} className="px-1 pb-3 -mb-px border-b-2 text-xs font-semibold mr-5 whitespace-nowrap">{children}</button>
  );
}

const STATUS_STYLES = {
  nouveau: { bg: '#FFF3CD', fg: '#7A5A00', icon: Clock },
  en_attente: { bg: '#FFF3CD', fg: '#7A5A00', icon: Clock },
  paiement_declare: { bg: '#E5F1FF', fg: '#1B4E8C', icon: CheckCircle2 },
  traite: { bg: '#E2F7EF', fg: '#1B6B5C', icon: CheckCircle2 },
};

function StatusPill({ status, labels }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.nouveau;
  const Icon = s.icon;
  return (
    <span style={{ background: s.bg, color: s.fg }} className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full flex items-center gap-1">
      <Icon size={11} /> {labels[status] || status}
    </span>
  );
}

function EmptyAdmin({ text }) {
  return (
    <div className="text-center py-14 border rounded-2xl" style={{ borderColor: '#E8E4FA' }}>
      <p className="text-3xl mb-2">📭</p>
      <p className="text-sm" style={{ color: '#6E6790' }}>{text}</p>
    </div>
  );
}

function SettingsPanel({ settings, saveSettings }) {
  const [waveBaseLink, setWaveBaseLink] = useState(settings.waveBaseLink || '');
  const [numbers, setNumbers] = useState(settings.receivingNumbers || {});
  const [catalog, setCatalog] = useState(settings.catalog || DEFAULT_CATALOG);
  const [catOp, setCatOp] = useState('orange');
  const [catType, setCatType] = useState('internet');
  const [newLabel, setNewLabel] = useState('');
  const [newDuree, setNewDuree] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);

  async function save() {
    setSaving(true); setSaveError(''); setSaveOk(false);
    try {
      await saveSettings({ ...settings, waveBaseLink: waveBaseLink.trim(), receivingNumbers: numbers, catalog });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e) {
      console.error('Erreur enregistrement paramètres :', e);
      setSaveError(`Échec de l'enregistrement : ${(e && e.message) || 'erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  }

  function addPass() {
    if (!newLabel.trim() || !(Number(newPrice) > 0)) return;
    const item = { id: 'c-' + Date.now(), label: newLabel.trim(), duree: newDuree.trim() || '1 jour', price: Number(newPrice) };
    setCatalog(c => ({ ...c, [catOp]: { ...c[catOp], [catType]: [...(c[catOp][catType] || []), item] } }));
    setNewLabel(''); setNewDuree(''); setNewPrice('');
  }
  function removePass(id) {
    setCatalog(c => ({ ...c, [catOp]: { ...c[catOp], [catType]: c[catOp][catType].filter(p => p.id !== id) } }));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#6E6790' }}>Lien de paiement Wave</p>
        <Field label="Votre lien Wave (ex: https://pay.wave.com/m/M_ci_XXXX/c/ci/)" value={waveBaseLink} onChange={setWaveBaseLink} placeholder="https://pay.wave.com/m/…" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#6E6790' }}>Numéros de réception (transfert d'argent)</p>
        <div className="space-y-2">
          {Object.keys(OPERATORS).map(op => (
            <Field key={op} label={OPERATORS[op].label} value={numbers[op] || ''} onChange={(v) => setNumbers(n => ({ ...n, [op]: v }))} placeholder="07 00 00 00 00" />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#6E6790' }}>Catalogue des pass</p>
        <div className="flex gap-2 mb-2">
          <select value={catOp} onChange={e => setCatOp(e.target.value)} className="border rounded-lg px-2 py-2 text-xs bg-white" style={{ borderColor: '#E8E4FA' }}>
            {Object.keys(OPERATORS).filter(o => o !== 'wave').map(o => <option key={o} value={o}>{OPERATORS[o].label}</option>)}
          </select>
          <select value={catType} onChange={e => setCatType(e.target.value)} className="border rounded-lg px-2 py-2 text-xs bg-white" style={{ borderColor: '#E8E4FA' }}>
            {Object.entries(PASS_TYPES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 mb-3">
          {(catalog[catOp]?.[catType] || []).map(p => (
            <div key={p.id} style={{ borderColor: '#E8E4FA' }} className="border rounded-lg px-3 py-2 flex items-center justify-between text-xs">
              <span>{p.label} <span style={{ color: '#9A93C4' }}>· {p.duree}</span></span>
              <div className="flex items-center gap-2">
                <span className="ref-ticket">{fmt(p.price)}</span>
                <button onClick={() => removePass(p.id)}><Trash2 size={13} color="#C0392B" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nom du pass" className="border rounded-lg px-2 py-2 text-xs bg-white" style={{ borderColor: '#E8E4FA' }} />
          <input value={newDuree} onChange={e => setNewDuree(e.target.value)} placeholder="Durée" className="border rounded-lg px-2 py-2 text-xs bg-white" style={{ borderColor: '#E8E4FA' }} />
          <input value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Prix" type="number" className="border rounded-lg px-2 py-2 text-xs bg-white" style={{ borderColor: '#E8E4FA' }} />
        </div>
        <button onClick={addPass} style={{ borderColor: '#E8E4FA' }} className="mt-2 border rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1"><Plus size={13} /> Ajouter ce pass</button>
      </div>
      <button onClick={save} disabled={saving} style={{ background: '#6C4CF5', color: '#FFFFFF' }} className="w-full py-3 rounded-full text-sm font-semibold">{saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button>
      {saveError && (
        <p style={{ color: '#C0392B', background: '#FDECEA' }} className="text-xs px-3 py-2 rounded-lg mt-3 break-words text-center">{saveError}</p>
      )}
      {saveOk && (
        <p style={{ color: '#1B6B5C', background: '#E2F7EF' }} className="text-xs px-3 py-2 rounded-lg mt-3 text-center">✅ Paramètres enregistrés.</p>
      )}
    </div>
  );
}
