import { useState, useEffect } from "react";

/* ============================================================
   ✏️  CONFIGURAÇÃO - edite apenas esta parte!
   ============================================================ */
const CONFIG = {
  momName: "Sarah Brandão",
  babyLine: "Celebrando a chegada das nossas princesas",
  dateText: "Domingo, 06 de setembro",
  timeText: "16 horas",
  locationName: "Alphaville Eusébio",
  locationAddress: "Eusébio - Ceará",
  pixKey: "SUA-CHAVE-PIX-AQUI",
  pixReceiverName: "Sarah Brandao",
  pixCity: "Eusebio",
};

type Gift = {
  id: string;
  name: string;
  value: number | null;
  category: string;
};

/* Categorias da lista de presentes (ordem de exibição) */
const CATEGORIES: { key: string; label: string }[] = [
  { key: "quarto", label: "Quarto" },
  { key: "banho-troca", label: "Banho e Troca" },
  { key: "alimentacao", label: "Alimentação" },
  { key: "passeio-descanso", label: "Passeio e Descanso" },
  { key: "roupinhas", label: "Roupinhas" },
  { key: "enxoval", label: "Enxoval" },
  { key: "higiene", label: "Higiene" },
  { key: "acessorios", label: "Acessórios" },
  { key: "fraldas", label: "Fraldas" },
];
const OUTROS_LABEL = "Outros";
const MONEY_CATEGORY = "dinheiro";
/* ============================================================ */

/* ---------- Roteamento simples por hash ---------- */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.replace("#", "") || "");

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash.replace("#", "") || "");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const go = (path: string) => {
    window.location.hash = path ? `#${path}` : "";
  };

  return { route: hash, go };
}

/* ---------- Pix "copia e cola" (padrão BR Code / EMV) ---------- */
function normalize(str: string, max: number) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 .\-_]/g, "")
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
        <p className="modal-eyebrow">Lista de presentes</p>
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
                placeholder="Valor do presente (ex: 50)"
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
              cole o código abaixo - o valor já vai preenchido:
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

/* ---------- Página de login do admin ---------- */
function AdminLoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLogging(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLogging(false);
    if (res.ok) {
      const data = await res.json();
      sessionStorage.setItem("admin_token", data.token);
      onLogin(data.token);
    } else {
      setError("Senha incorreta");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-card">
        <p className="modal-eyebrow">Administração</p>
        <h3 className="modal-title">Acesso restrito</h3>
        <input
          className="input"
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          autoFocus
        />
        {error && <p className="admin-error">{error}</p>}
        <button className="btn btn-solid" disabled={!password || logging} onClick={handleLogin}>
          {logging ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Dashboard do admin ---------- */
function AdminDashboard({
  token,
  gifts,
  onLogout,
  onGiftsChange,
}: {
  token: string;
  gifts: Gift[];
  onLogout: () => void;
  onGiftsChange: () => void;
}) {
  const [dashboard, setDashboard] = useState<{
    reservations: { gift_id: string; guest_name: string; amount: number; created_at: string }[];
    rsvps: { id: number; name: string; people: number; created_at: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"gifts" | "reservations" | "rsvps" | "register">("gifts");

  const [regGift, setRegGift] = useState("");
  const [regName, setRegName] = useState("");
  const [regAmount, setRegAmount] = useState("");
  const [regSaving, setRegSaving] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regOk, setRegOk] = useState(false);

  const [editGift, setEditGift] = useState<Gift | null>(null);
  const [giftName, setGiftName] = useState("");
  const [giftValue, setGiftValue] = useState("");
  const [giftCategory, setGiftCategory] = useState(CATEGORIES[0].key);
  const [giftSaving, setGiftSaving] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard", { headers: authHeaders });
      if (res.ok) setDashboard(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadDashboard(); }, []);

  const deleteReservation = async (giftId: string) => {
    await fetch(`/api/admin/reservations/${giftId}`, { method: "DELETE", headers: authHeaders });
    loadDashboard();
  };

  const deleteRsvp = async (id: number) => {
    await fetch(`/api/admin/rsvps/${id}`, { method: "DELETE", headers: authHeaders });
    loadDashboard();
  };

  const handleRegister = async () => {
    setRegError(null);
    setRegOk(false);
    setRegSaving(true);
    const res = await fetch("/api/admin/reservations", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        gift_id: regGift,
        guest_name: regName.trim(),
        amount: parseFloat(regAmount.replace(",", ".")),
      }),
    });
    setRegSaving(false);
    if (res.ok) {
      setRegOk(true);
      setRegGift("");
      setRegName("");
      setRegAmount("");
      loadDashboard();
      setTimeout(() => setRegOk(false), 3000);
    } else {
      const data = await res.json();
      setRegError(data.error || "Erro ao registrar");
    }
  };

  const totalGifts = dashboard ? dashboard.reservations.reduce((s, r) => s + r.amount, 0) : 0;
  const totalConfirmed = dashboard ? dashboard.rsvps.reduce((s, r) => s + r.people, 0) : 0;
  const availableGifts = gifts.filter((g) => !dashboard?.reservations.some((r) => r.gift_id === g.id));

  /* --- Gift management helpers --- */
  const startNewGift = () => {
    setEditGift(null);
    setGiftName("");
    setGiftValue("");
    setGiftCategory(CATEGORIES[0].key);
    setGiftError(null);
  };

  const startEditGift = (g: Gift) => {
    setEditGift(g);
    setGiftName(g.name);
    setGiftValue(g.value != null ? String(g.value) : "");
    setGiftCategory(g.category || CATEGORIES[0].key);
    setGiftError(null);
  };

  const saveGift = async () => {
    setGiftError(null);
    setGiftSaving(true);
    const fd = new FormData();
    fd.append("name", giftName.trim());
    fd.append("value", giftValue.trim());
    fd.append("category", giftCategory);

    const url = editGift ? `/api/admin/gifts/${editGift.id}` : "/api/admin/gifts";
    const method = editGift ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: authHeaders, body: fd });
    setGiftSaving(false);
    if (res.ok) {
      onGiftsChange();
      startNewGift();
    } else {
      const data = await res.json();
      setGiftError(data.error || "Erro ao salvar");
    }
  };

  const deleteGift = async (giftId: string) => {
    await fetch(`/api/admin/gifts/${giftId}`, { method: "DELETE", headers: authHeaders });
    onGiftsChange();
    if (editGift?.id === giftId) startNewGift();
  };

  return (
    <div className="admin-page">
      <div className="admin-card admin-dashboard">
        <div className="admin-header">
          <div className="admin-title">
            <p className="modal-eyebrow">Painel de Administração</p>
            <h3 className="modal-title">Chá de Bebê - Sarah Brandão</h3>
          </div>
          <button className="btn btn-outline admin-logout" onClick={onLogout}>
            Sair
          </button>
        </div>

        <div className="admin-summary">
          <div className="admin-stat">
            <span className="admin-stat-num">{dashboard?.reservations.length ?? 0}</span>
            <span className="admin-stat-label">presentes</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-num">{brl(totalGifts)}</span>
            <span className="admin-stat-label">em presentes</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-num">{totalConfirmed}</span>
            <span className="admin-stat-label">confirmados</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-num">{availableGifts.length}</span>
            <span className="admin-stat-label">disponíveis</span>
          </div>
        </div>

        <div className="admin-tabs">
          {(["gifts", "reservations", "rsvps", "register"] as const).map((t) => (
            <button
              key={t}
              className={`admin-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "gifts" ? "Presentes" : t === "reservations" ? "Presenteados" : t === "rsvps" ? "Presenças" : "Registrar"}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="loading">Carregando…</p>
        ) : (
          <>
            {/* --- Aba Presentes (gerenciamento de presentes) --- */}
            {tab === "gifts" && (
              <div className="gift-manager">
                <div className="gift-manager-list">
                  {(() => {
                    const allCategories = [...CATEGORIES, { key: MONEY_CATEGORY, label: "Dinheiro" }];
                    const groups = allCategories.map((c) => ({
                      label: c.label,
                      items: gifts.filter((g) => g.category === c.key),
                    })).filter((group) => group.items.length > 0);

                    const known = new Set(allCategories.map((c) => c.key));
                    const outros = gifts.filter((g) => !known.has(g.category));
                    if (outros.length > 0) groups.push({ label: "Outros", items: outros });

                    return groups.map((group) => (
                      <div key={group.label} className="gift-manager-group">
                        <h5 className="gift-manager-group-title">{group.label}</h5>
                        {group.items.map((g) => (
                          <div
                            key={g.id}
                            className={`gift-manager-item ${editGift?.id === g.id ? "active" : ""}`}
                            onClick={() => startEditGift(g)}
                          >
                            <div className="gift-manager-info">
                              <span className="gift-manager-name">{g.name}</span>
                              <span className="gift-manager-value">
                                {g.value != null ? brl(g.value) : "livre"}
                              </span>
                            </div>
                            <button
                              className="admin-del-btn"
                              onClick={(e) => { e.stopPropagation(); deleteGift(g.id); }}
                              title="Excluir presente"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>

                <div className="gift-manager-form">
                  <h4>{editGift ? "Editar presente" : "Novo presente"}</h4>
                  <input
                    className="input"
                    placeholder="Nome do presente"
                    value={giftName}
                    onChange={(e) => setGiftName(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Valor (R$) - vazio = livre"
                    inputMode="decimal"
                    value={giftValue}
                    onChange={(e) => setGiftValue(e.target.value)}
                  />
                  <select
                    className="input"
                    value={giftCategory}
                    onChange={(e) => setGiftCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                    <option value={MONEY_CATEGORY}>Presente em Dinheiro</option>
                  </select>
                  {giftError && <p className="admin-error">{giftError}</p>}
                  <div className="gift-manager-actions">
                    <button className="btn btn-solid" disabled={!giftName.trim() || giftSaving} onClick={saveGift}>
                      {giftSaving ? "Salvando…" : editGift ? "Atualizar" : "Adicionar"}
                    </button>
                    {editGift && (
                      <button className="btn btn-outline" onClick={startNewGift}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- Aba Presenteados --- */}
            {tab === "reservations" && (
              <div className="admin-table-wrap">
                {dashboard && dashboard.reservations.length === 0 ? (
                  <p className="admin-empty">Nenhum presente registrado ainda.</p>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Presente</th>
                        <th>Convidado(a)</th>
                        <th>Valor</th>
                        <th>Data</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard?.reservations.map((r) => {
                        const gift = gifts.find((g) => g.id === r.gift_id);
                        return (
                          <tr key={r.gift_id}>
                            <td>{gift?.name ?? r.gift_id}</td>
                            <td>{r.guest_name}</td>
                            <td>{brl(r.amount)}</td>
                            <td>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                            <td>
                              <button className="admin-del-btn" onClick={() => deleteReservation(r.gift_id)}>
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* --- Aba Presenças --- */}
            {tab === "rsvps" && (
              <div className="admin-table-wrap">
                {dashboard && dashboard.rsvps.length === 0 ? (
                  <p className="admin-empty">Nenhuma presença confirmada ainda.</p>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Pessoas</th>
                        <th>Data</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard?.rsvps.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.people}</td>
                          <td>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                          <td>
                            <button className="admin-del-btn" onClick={() => deleteRsvp(r.id)}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* --- Aba Registrar (manual) --- */}
            {tab === "register" && (
              <div className="admin-register">
                <p className="modal-text">
                  Registre manualmente um presente - útil quando alguém entrega em mãos.
                </p>
                <select
                  className="input admin-select"
                  value={regGift}
                  onChange={(e) => {
                    setRegGift(e.target.value);
                    const g = gifts.find((g) => g.id === e.target.value);
                    setRegAmount(g?.value != null ? String(g.value) : "");
                  }}
                >
                  <option value="">Escolha o presente…</option>
                  {gifts.map((g) => {
                    const already = dashboard?.reservations.some((r) => r.gift_id === g.id);
                    return (
                      <option key={g.id} value={g.id} disabled={already}>
                        {g.name} {already ? "(já presenteado)" : ""}
                      </option>
                    );
                  })}
                </select>
                <input
                  className="input"
                  placeholder="Nome do(a) convidado(a)"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  maxLength={40}
                />
                <input
                  className="input"
                  placeholder="Valor (R$)"
                  inputMode="decimal"
                  value={regAmount}
                  onChange={(e) => setRegAmount(e.target.value)}
                />
                {regError && <p className="admin-error">{regError}</p>}
                {regOk && <p className="admin-ok">Presente registrado!</p>}
                <button
                  className="btn btn-solid"
                  disabled={!regGift || !regName.trim() || !regAmount || regSaving}
                  onClick={handleRegister}
                >
                  {regSaving ? "Registrando…" : "Registrar presente"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Página inicial ---------- */
function LandingPage({ gifts, onOpenAdmin }: { gifts: Gift[]; onOpenAdmin: () => void }) {
  const [reservations, setReservations] = useState<Record<string, boolean>>({});
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
    <>
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
        <h2 className="section-title">Lista de Presentes</h2>
        <Ornament />
        <p className="section-intro">
          Escolha um presente e envie um Pix no valor
          correspondente - assim {CONFIG.momName.split(" ")[0]} monta o enxoval
          dos bebês do jeitinho que precisam. Assim que alguém presenteia, o
          item aparece como já presenteado para os próximos convidados.
        </p>

        {loading ? (
          <p className="loading">Preparando a lista…</p>
        ) : (
          (() => {
            const listGifts = gifts.filter((g) => g.category !== MONEY_CATEGORY);
            const groups = CATEGORIES.map((c) => ({
              label: c.label,
              items: listGifts.filter((g) => g.category === c.key),
            })).filter((group) => group.items.length > 0);

            const known = new Set(CATEGORIES.map((c) => c.key));
            const outros = listGifts.filter((g) => !known.has(g.category));
            if (outros.length > 0) groups.push({ label: OUTROS_LABEL, items: outros });

            return groups.map((group) => (
              <div key={group.label} className="gift-category">
                <h3 className="gift-category-title">{group.label}</h3>
                <div className="gifts">
                  {group.items.map((g) => {
                    const r = reservations[g.id];
                    return (
                      <div key={g.id} className={`gift frame ${r ? "taken" : ""}`}>
                        <p className="gift-name">{g.name}</p>
                        <p className="gift-value">
                          {g.value ? brl(g.value) : "valor à sua escolha"}
                        </p>
                        {r ? (
                          <p className="gift-taken">Já presenteado, obrigada!</p>
                        ) : (
                          <button className="btn btn-outline" onClick={() => setOpenGift(g)}>
                            Presentear via Pix
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()
        )}
      </section>

      {/* MIMO EM DINHEIRO */}
      {(() => {
        const moneyGifts = gifts.filter((g) => g.category === MONEY_CATEGORY);
        if (loading || moneyGifts.length === 0) return null;
        return (
          <section className="section rose money-section">
            <p className="eyebrow center">Se preferir</p>
            <h2 className="section-title">Presente em Dinheiro</h2>
            <Ornament />
            <p className="section-intro">
              Prefere contribuir livremente? Envie um Pix no valor que desejar
              e ajude a preparar a chegada dos bebês.
            </p>
            <div className="gifts money-gifts">
              {moneyGifts.map((g) => {
                const r = reservations[g.id];
                return (
                  <div key={g.id} className={`gift money-gift frame ${r ? "taken" : ""}`}>
                    <p className="gift-name">{g.name}</p>
                    <p className="gift-value">valor à sua escolha</p>
                    {r ? (
                      <p className="gift-taken">Já presenteado, obrigada!</p>
                    ) : (
                      <button className="btn btn-solid" onClick={() => setOpenGift(g)}>
                        Presentear via Pix
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

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
        <p>Com amor, aguardamos você - família Brandão</p>
        <p className="footer-verse">
          "Eu vos fui entregue desde o meu nascer, desde o ventre da minha
          mãe vós sois o meu Deus." — Salmo 21, 11
        </p>
        <button className="admin-link" onClick={onOpenAdmin}>
          admin
        </button>
      </footer>

      {openGift && (
        <GiftModal
          gift={openGift}
          onClose={() => setOpenGift(null)}
          onConfirm={confirmGift}
        />
      )}
      {thanks && <div className="toast">Obrigada pelo carinho, {thanks}!</div>}
    </>
  );
}

/* ---------- App ---------- */
export default function ChaDeBebe() {
  const { route, go } = useHashRoute();
  const [adminToken, setAdminToken] = useState(sessionStorage.getItem("admin_token") || "");
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(true);

  const isAdminRoute = route === "admin" || route.startsWith("admin/");

  const loadGifts = async () => {
    try {
      const res = await fetch("/api/gifts");
      if (res.ok) {
        const data = await res.json();
        setGifts(data.gifts || []);
      }
    } catch {}
    setGiftsLoading(false);
  };

  useEffect(() => { loadGifts(); }, []);

  useEffect(() => {
    if (isAdminRoute && !adminToken) {
    }
  }, [isAdminRoute, adminToken]);

  const handleLogin = (token: string) => {
    setAdminToken(token);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    setAdminToken("");
    go("");
  };

  if (giftsLoading) {
    return (
      <div className="page">
        <style>{css}</style>
        <div className="loading" style={{ paddingTop: 120 }}>Carregando…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <style>{css}</style>

      {isAdminRoute ? (
        adminToken ? (
          <AdminDashboard token={adminToken} gifts={gifts} onLogout={handleLogout} onGiftsChange={loadGifts} />
        ) : (
          <AdminLoginPage onLogin={handleLogin} />
        )
      ) : (
        <LandingPage gifts={gifts} onOpenAdmin={() => go("admin")} />
      )}
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
  font-weight: 400; color: var(--dourado); margin: 0 auto 10px;
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
  font-size: clamp(32px, 5vw, 44px); text-align: center; margin: 0 auto;
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

/* CATEGORIAS DE PRESENTES */
.gift-category { margin-bottom: 48px; }
.gift-category:last-child { margin-bottom: 0; }
.gift-category-title {
  font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 500;
  font-size: 24px; text-align: center; color: var(--rosa-antigo);
  margin: 0 auto 20px;
}

/* MIMO EM DINHEIRO */
.money-section { padding-top: 56px; padding-bottom: 56px; }
.money-gifts { max-width: 420px; margin: 0 auto; grid-template-columns: 1fr; }
.money-gift { background: #FFFDFB; border-width: 2px; }

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
.footer .footer-verse {
  font-size: 14px; max-width: 420px; margin: 14px auto 0;
  opacity: 0.65; line-height: 1.6;
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

/* ADMIN */
.admin-link {
  display: block; margin: 18px auto 0; background: none; border: none;
  color: var(--dourado); font-size: 11px; cursor: pointer;
  text-transform: uppercase; letter-spacing: 0.25em; opacity: 0.85;
  transition: opacity 0.15s, color 0.15s;
}
.admin-link:hover { opacity: 1; color: var(--tinta); }

.admin-page {
  min-height: 100vh; padding: 48px 24px;
  display: flex; align-items: flex-start; justify-content: center;
  background: var(--porcelana);
}
.admin-card {
  width: 100%; max-width: 760px; padding: 40px 36px;
  border: 1px solid var(--dourado); background: #FFFDFB;
  display: flex; flex-direction: column; gap: 18px;
}
.admin-card .modal-title { font-size: 26px; }
.admin-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  flex-wrap: wrap; gap: 16px;
  border-bottom: 1px solid rgba(176,141,87,0.25); padding-bottom: 16px;
}
.admin-title { text-align: left; }
.admin-logout { padding: 8px 18px; font-size: 11px; letter-spacing: 0.18em; align-self: flex-start; }

.admin-summary { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-start; }
.admin-stat {
  background: var(--rose); padding: 14px 20px; text-align: center;
  min-width: 100px; display: flex; flex-direction: column; flex: 1; min-width: 120px;
}
.admin-stat-num {
  font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 500;
  color: var(--tinta);
}
.admin-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3em; color: var(--dourado); }

.admin-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--dourado); margin-top: 4px; }
.admin-tab {
  flex: 1; background: none; border: none; padding: 10px 8px; cursor: pointer;
  font-family: 'Jost', sans-serif; font-size: 12px; text-transform: uppercase;
  letter-spacing: 0.15em; color: var(--rosa-antigo);
  border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s;
}
.admin-tab.active { color: var(--tinta); border-bottom-color: var(--dourado); }
.admin-tab:hover { color: var(--tinta); }
.admin-table-wrap { max-height: 400px; overflow-y: auto; width: 100%; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.admin-table th {
  text-transform: uppercase; letter-spacing: 0.15em; font-size: 10px; font-weight: 400;
  color: var(--dourado); text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--dourado);
  position: sticky; top: 0; background: #FFFDFB;
}
.admin-table td { padding: 8px 10px; border-bottom: 1px solid rgba(176,141,87,0.2); }
.admin-del-btn {
  background: none; border: none; cursor: pointer; color: var(--rosa-antigo);
  font-size: 12px; padding: 2px 6px; opacity: 0.6; transition: opacity 0.15s;
}
.admin-del-btn:hover { opacity: 1; color: #c0392b; }
.admin-empty { text-align: center; opacity: 0.6; padding: 24px 0; font-size: 14px; }
.admin-register { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; width: 100%; max-width: 420px; }
.admin-register .input { width: 100%; min-width: auto; }
.admin-select { min-width: auto !important; }
.admin-error { color: #c0392b; font-size: 13px; margin: 0; }
.admin-ok { color: #27ae60; font-size: 13px; margin: 0; font-weight: 500; }
@media (max-width: 640px) {
  .admin-card { padding: 28px 20px; }
  .admin-summary { gap: 8px; }
  .admin-stat { min-width: 80px; padding: 12px 10px; }
  .admin-stat-num { font-size: 20px; }
  .admin-table th, .admin-table td { padding: 8px 6px; font-size: 12px; }
}

/* GIFT MANAGER (admin) */
.gift-manager { display: flex; gap: 24px; width: 100%; }
.gift-manager-list {
  flex: 1; display: flex; flex-direction: column; gap: 8px;
  max-height: 480px; overflow-y: auto;
}
.gift-manager-group { display: flex; flex-direction: column; gap: 8px; }
.gift-manager-group-title {
  font-family: 'Jost', sans-serif; font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.2em; color: var(--dourado); margin: 10px 0 0; font-weight: 500;
}
.gift-manager-group:first-child .gift-manager-group-title { margin-top: 0; }
.gift-manager-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px; border: 1px solid rgba(176,141,87,0.2); background: #FFFDFB;
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
}
.gift-manager-item:hover { border-color: var(--dourado); }
.gift-manager-item.active { border-color: var(--dourado); background: var(--rose); }
.gift-manager-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.gift-manager-name { font-size: 14px; font-weight: 400; }
.gift-manager-value {
  font-size: 11px; color: var(--dourado); text-transform: uppercase; letter-spacing: 0.1em;
}
.gift-manager-form {
  flex: 1; display: flex; flex-direction: column; gap: 12px; align-items: stretch;
}
.gift-manager-form h4 {
  font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 500; margin: 0;
}
.gift-manager-form .input { width: 100%; min-width: auto; }
.gift-manager-actions { display: flex; gap: 10px; }
@media (max-width: 700px) {
  .gift-manager { flex-direction: column; }
  .gift-manager-list { max-height: 240px; }
}
`;

