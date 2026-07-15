import { useState, useEffect } from "react";

/* ============================================================
   ✏️  CONFIGURAÇÃO — edite apenas esta parte!
   ============================================================ */
const CONFIG = {
  momName: "Sarah Brandão",
  babyLine: "Celebrando a chegada da nossa princesa",
  dateText: "Domingo, 06 de setembro",
  timeText: "16 horas", // ⚠️ confirme o horário
  locationName: "Alphaville Eusébio",
  locationAddress: "Eusébio — Ceará",
  pixKey: "SUA-CHAVE-PIX-AQUI", // ⚠️ CPF, e-mail, celular ou chave aleatória
  pixReceiverName: "Sarah Brandao", // nome cadastrado na chave (sem acentos)
  pixCity: "Eusebio",
};

const GIFTS = [
  { id: "fralda-rn", name: "Pacote de fraldas RN", value: 60 },
  { id: "fralda-p", name: "Pacote de fraldas P", value: 60 },
  { id: "fralda-m", name: "Pacote de fraldas M", value: 65 },
  { id: "bodies", name: "Kit de bodies", value: 90 },
  { id: "manta", name: "Manta de tricô", value: 120 },
  { id: "banho", name: "Kit banho da bebê", value: 150 },
  { id: "trocador", name: "Trocador & pomadas", value: 80 },
  { id: "higiene", name: "Kit higiene", value: 70 },
  { id: "naninha", name: "Naninha", value: 55 },
  { id: "mobile", name: "Mobile para o berço", value: 85 },
  { id: "carrinho", name: "Cota do carrinho", value: 200 },
  { id: "berco", name: "Cota do berço", value: 250 },
  { id: "livre", name: "Mimo à sua escolha", value: null },
];
/* ============================================================ */

/* ---------- Pix "copia e cola" (padrão BR Code / EMV) ---------- */
function normalize(str: string, max: number) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 .\-@_]/g, "")
    .trim()
    .slice(0, max);
}
function emv(id: string, value: string) {
  return id + String(value.length).padStart(2, "0") + value;
}
function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function buildPixCode(amount: number) {
  const merchantInfo = emv("00", "br.gov.bcb.pix") + emv("01", CONFIG.pixKey.trim());
  let payload =
    emv("00", "01") +
    emv("26", merchantInfo) +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", amount.toFixed(2)) +
    emv("58", "BR") +
    emv("59", normalize(CONFIG.pixReceiverName, 25) || "RECEBEDOR") +
    emv("60", normalize(CONFIG.pixCity, 15) || "BRASIL") +
    emv("62", emv("05", "***")) +
    "6304";
  return payload + crc16(payload);
}
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ---------- Divisor ornamental ---------- */
function Ornament() {
  return (
    <div className="ornament" aria-hidden="true">
      <span className="ornament-line" />
      <span className="ornament-mark">❖</span>
      <span className="ornament-line" />
    </div>
  );
}

/* ---------- Modal de presente ---------- */
function GiftModal({
  gift,
  onClose,
  onConfirm,
}: {
  gift: { id: string; name: string; value: number | null };
  onClose: () => void;
  onConfirm: (giftId: string, guestName: string, amount: number) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [guest, setGuest] = useState("");
  const [freeValue, setFreeValue] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amount =
    gift.value ?? (parseFloat(String(freeValue).replace(",", ".")) || 0);
  const pixCode = amount > 0 ? buildPixCode(amount) : "";

  const copy = async (text: string, which: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  const confirm = async () => {
    setSaving(true);
    await onConfirm(gift.id, guest.trim(), amount);
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal frame" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
        <p className="modal-eyebrow">Lista de mimos</p>
        <h3 className="modal-title">{gift.name}</h3>

        {step === 1 && (
          <>
            <p className="modal-text">
              Que gentileza! Deixe seu nome para registrarmos quem presenteou:
            </p>
            <input
              className="input"
              placeholder="Seu nome"
              value={guest}
              onChange={(e) => setGuest(e.target.value)}
              maxLength={40}
              autoFocus
            />
            {gift.value === null && (
              <input
                className="input"
                placeholder="Valor do mimo (ex: 50)"
                inputMode="decimal"
                value={freeValue}
                onChange={(e) => setFreeValue(e.target.value)}
              />
            )}
            <button
              className="btn btn-solid"
              disabled={!guest.trim() || !(amount > 0)}
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="modal-value">{brl(amount)}</p>
            <p className="modal-text">
              No app do seu banco, escolha <strong>Pix → Copia e Cola</strong> e
              cole o código abaixo — o valor já vai preenchido:
            </p>
            <div className="pix-box">
              <code>{pixCode}</code>
            </div>
            <button className="btn btn-outline" onClick={() => copy(pixCode, "code")}>
              {copied === "code" ? "Copiado ✓" : "Copiar código Pix"}
            </button>
            <p className="modal-alt">
              Ou, se preferir, use a chave Pix:{" "}
              <button className="link-btn" onClick={() => copy(CONFIG.pixKey, "key")}>
                {CONFIG.pixKey} {copied === "key" ? "✓" : "⧉"}
              </button>
            </p>
            <button className="btn btn-solid" onClick={confirm} disabled={saving}>
              {saving ? "Registrando..." : "Já enviei o Pix"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- App ---------- */
export default function ChaDeBebe() {
  const [reservations, setReservations] = useState<Record<string, { name: string; amount: number; date: string }>>({});
  const [loading, setLoading] = useState(true);
  const [openGift, setOpenGift] = useState<{ id: string; name: string; value: number | null } | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpCount, setRsvpCount] = useState("1");
  const [rsvpDone, setRsvpDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reservations");
        if (res.ok) setReservations(await res.json());
      } catch { /* usa estado vazio */ }
      setLoading(false);
    })();
  }, []);

  const confirmGift = async (giftId: string, guestName: string, amount: number) => {
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gift_id: giftId, guest_name: guestName, amount }),
    });
    if (res.ok) {
      setReservations(await res.json());
      setOpenGift(null);
      setThanks(guestName);
      setTimeout(() => setThanks(null), 5000);
    }
  };

  const sendRsvp = async () => {
    const res = await fetch("/api/rsvps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: rsvpName.trim(), people: parseInt(rsvpCount, 10) || 1 }),
    });
    if (res.ok) setRsvpDone(true);
  };

  return (
    <div className="page">
      <style>{css}</style>

      {/* HERO */}
      <header className="hero">
        <div className="hero-frame">
          <p className="eyebrow">Chá de bebê</p>
          <h1 className="mom-name">Sarah Brandão</h1>
          <Ornament />
          <p className="hero-sub">{CONFIG.babyLine}</p>
          <p className="hero-meta">
            {CONFIG.dateText} · {CONFIG.timeText}
            <br />
            {CONFIG.locationName}
          </p>
        </div>
      </header>

      {/* DETALHES */}
      <section className="section rose">
        <div className="details">
          <div className="detail-card frame">
            <p className="detail-label">Quando</p>
            <p className="detail-title">{CONFIG.dateText}</p>
            <p className="detail-sub">a partir das {CONFIG.timeText}</p>
          </div>
          <div className="detail-card frame">
            <p className="detail-label">Onde</p>
            <p className="detail-title">{CONFIG.locationName}</p>
            <p className="detail-sub">{CONFIG.locationAddress}</p>
          </div>
        </div>
      </section>

      {/* LISTA DE PRESENTES */}
      <section className="section">
        <p className="eyebrow center">Com carinho</p>
        <h2 className="section-title">Lista de Mimos</h2>
        <Ornament />
        <p className="section-intro">
          Escolha um mimo e envie um <strong>Pix simbólico</strong> no valor
          correspondente — assim Sarah monta o enxoval do jeitinho que a bebê
          precisa. O mimo escolhido fica registrado aqui para todos os convidados.
        </p>

        {loading ? (
          <p className="loading">Preparando a lista…</p>
        ) : (
          <div className="gifts">
            {GIFTS.map((g) => {
              const r = reservations[g.id];
              return (
                <div key={g.id} className={`gift frame ${r ? "taken" : ""}`}>
                  <p className="gift-name">{g.name}</p>
                  <p className="gift-value">
                    {g.value ? brl(g.value) : "valor à sua escolha"}
                  </p>
                  {r ? (
                    <p className="gift-taken">Presenteado por {r.name}</p>
                  ) : (
                    <button className="btn btn-outline" onClick={() => setOpenGift(g)}>
                      Presentear via Pix
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* RSVP */}
      <section className="section rose">
        <p className="eyebrow center">Sua presença é o maior presente</p>
        <h2 className="section-title">Confirmar Presença</h2>
        <Ornament />
        {rsvpDone ? (
          <p className="rsvp-done">Presença confirmada. Até o dia 06 de setembro!</p>
        ) : (
          <div className="rsvp">
            <input
              className="input"
              placeholder="Seu nome"
              value={rsvpName}
              onChange={(e) => setRsvpName(e.target.value)}
              maxLength={40}
            />
            <select
              className="input"
              value={rsvpCount}
              onChange={(e) => setRsvpCount(e.target.value)}
              aria-label="Quantas pessoas"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "pessoa" : "pessoas"}
                </option>
              ))}
            </select>
            <button className="btn btn-solid" disabled={!rsvpName.trim()} onClick={sendRsvp}>
              Confirmar
            </button>
          </div>
        )}
      </section>

      <footer className="footer">
        <Ornament />
        <p>Com amor, aguardamos você — família Brandão</p>
      </footer>

      {openGift && (
        <GiftModal
          gift={openGift}
          onClose={() => setOpenGift(null)}
          onConfirm={confirmGift}
        />
      )}
      {thanks && <div className="toast">Obrigada pelo carinho, {thanks}!</div>}
    </div>
  );
}

/* ---------- Estilos ---------- */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500&display=swap');

* { box-sizing: border-box; }
.page {
  --porcelana: #FBF7F4; --rose: #F1E3DF; --rosa-antigo: #C89B94;
  --dourado: #B08D57; --tinta: #3C2F2F;
  font-family: 'Jost', sans-serif; font-weight: 300;
  color: var(--tinta); background: var(--porcelana); min-height: 100vh;
  font-size: 16.5px; letter-spacing: 0.01em;
}
strong { font-weight: 500; }

.eyebrow {
  text-transform: uppercase; letter-spacing: 0.42em; font-size: 12px;
  font-weight: 400; color: var(--dourado); margin: 0 0 10px;
}
.eyebrow.center { text-align: center; }

/* HERO */
.hero { padding: 64px 24px; display: flex; justify-content: center; }
.hero-frame {
  text-align: center; padding: 56px 40px; max-width: 640px; width: 100%;
  border: 1px solid var(--dourado); position: relative;
}
.hero-frame::after {
  content: ""; position: absolute; inset: 7px;
  border: 1px solid rgba(176,141,87,0.45); pointer-events: none;
}
.mom-name {
  font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 500;
  font-size: clamp(44px, 9vw, 76px); line-height: 1.08; margin: 0;
  color: var(--tinta);
}
.hero-sub {
  font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: 21px; margin: 6px 0 22px; color: var(--rosa-antigo);
}
.hero-meta { margin: 0; line-height: 1.7; letter-spacing: 0.08em; font-size: 15px; }

/* ORNAMENTO */
.ornament {
  display: flex; align-items: center; justify-content: center; gap: 14px;
  margin: 18px auto 22px; max-width: 260px;
}
.ornament-line { flex: 1; height: 1px; background: var(--dourado); opacity: 0.6; }
.ornament-mark { color: var(--dourado); font-size: 10px; }

/* SEÇÕES */
.section { padding: 72px 24px; max-width: 1020px; margin: 0 auto; }
.rose { background: var(--rose); max-width: none; }
.rose > * { max-width: 1020px; margin-left: auto; margin-right: auto; }
.section-title {
  font-family: 'Cormorant Garamond', serif; font-weight: 500;
  font-size: clamp(32px, 5vw, 44px); text-align: center; margin: 0;
}
.section-intro {
  text-align: center; max-width: 580px; margin: 0 auto 44px; line-height: 1.75;
}

/* MOLDURA fina */
.frame { border: 1px solid var(--dourado); background: #FFFDFB; }

/* DETALHES */
.details { display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; }
.detail-card { padding: 36px 44px; text-align: center; min-width: 260px; flex: 1; max-width: 380px; }
.detail-label {
  text-transform: uppercase; letter-spacing: 0.4em; font-size: 11px;
  color: var(--dourado); margin: 0 0 12px;
}
.detail-title {
  font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 500;
  margin: 0 0 6px;
}
.detail-sub { margin: 0; opacity: 0.75; }

/* PRESENTES */
.gifts { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 20px; }
.gift {
  padding: 32px 22px; text-align: center;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.gift:hover:not(.taken) { box-shadow: 0 10px 30px rgba(60,47,47,0.08); transform: translateY(-2px); }
.gift.taken { background: var(--rose); }
.gift-name {
  font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 500;
  margin: 0; line-height: 1.25;
}
.gift-value {
  color: var(--dourado); letter-spacing: 0.12em; font-size: 14px;
  text-transform: uppercase; margin: 0 0 10px;
}
.gift-taken {
  font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: 17px; color: var(--rosa-antigo); margin: 6px 0 0;
}
.loading { text-align: center; opacity: 0.7; }

/* BOTÕES */
.btn {
  font-family: 'Jost', sans-serif; font-weight: 400; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.22em;
  padding: 12px 26px; cursor: pointer; border-radius: 0;
  transition: background 0.18s ease, color 0.18s ease;
}
.btn:focus-visible { outline: 2px solid var(--tinta); outline-offset: 3px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-solid { background: var(--tinta); color: #FBF7F4; border: 1px solid var(--tinta); }
.btn-solid:hover:not(:disabled) { background: var(--rosa-antigo); border-color: var(--rosa-antigo); }
.btn-outline { background: transparent; color: var(--tinta); border: 1px solid var(--dourado); }
.btn-outline:hover:not(:disabled) { background: var(--dourado); color: #FBF7F4; }

/* RSVP */
.rsvp { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
.rsvp-done {
  text-align: center; font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: 22px; color: var(--rosa-antigo);
}
.input {
  font-family: 'Jost', sans-serif; font-weight: 300; font-size: 15px;
  padding: 12px 18px; border: 1px solid var(--dourado); border-radius: 0;
  background: #FFFDFB; color: var(--tinta); min-width: 210px;
}
.input:focus-visible { outline: 2px solid var(--tinta); outline-offset: 2px; }

/* FOOTER */
.footer { text-align: center; padding: 48px 24px 64px; }
.footer p {
  font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: 19px; margin: 0; opacity: 0.85;
}

/* MODAL */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(60,47,47,0.5);
  display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50;
}
.modal {
  position: relative; width: 100%; max-width: 440px; padding: 40px 32px;
  display: flex; flex-direction: column; gap: 14px; align-items: center; text-align: center;
  max-height: 90vh; overflow-y: auto;
}
.modal-close {
  position: absolute; top: 14px; right: 16px; background: none; border: none;
  font-size: 16px; cursor: pointer; color: var(--tinta); opacity: 0.55;
}
.modal-eyebrow {
  text-transform: uppercase; letter-spacing: 0.4em; font-size: 11px;
  color: var(--dourado); margin: 0;
}
.modal-title {
  font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 500; margin: 0;
}
.modal-text { margin: 0; line-height: 1.65; font-size: 15px; }
.modal-value {
  font-family: 'Cormorant Garamond', serif; font-size: 36px; font-weight: 500;
  color: var(--dourado); margin: 0;
}
.modal-alt { font-size: 13px; opacity: 0.85; margin: 0; }
.link-btn {
  background: none; border: none; color: var(--dourado); font-weight: 500;
  cursor: pointer; font-size: 13px; text-decoration: underline; word-break: break-all;
}
.pix-box {
  background: var(--rose); padding: 14px; width: 100%;
  max-height: 110px; overflow-y: auto; border: 1px solid rgba(176,141,87,0.4);
}
.pix-box code { font-size: 11px; word-break: break-all; color: var(--tinta); }

/* TOAST */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: var(--tinta); color: #FBF7F4;
  font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 18px;
  padding: 14px 30px; box-shadow: 0 10px 30px rgba(60,47,47,0.3); z-index: 60;
}

@media (prefers-reduced-motion: reduce) {
  .btn, .gift { transition: none; }
  .gift:hover:not(.taken) { transform: none; }
}
`;