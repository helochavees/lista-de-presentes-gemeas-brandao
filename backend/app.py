import os
import sys
import uuid
import secrets
import libsql
import webbrowser
import threading
from datetime import datetime, timezone
from functools import wraps
from flask import Flask, request, jsonify, g, send_from_directory

TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")


class _Row(dict):
    """dict that also supports positional access, like sqlite3.Row."""
    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


class _Cursor:
    def __init__(self, cursor):
        self._cursor = cursor

    def _columns(self):
        return [d[0] for d in self._cursor.description] if self._cursor.description else []

    def fetchone(self):
        row = self._cursor.fetchone()
        return _Row(zip(self._columns(), row)) if row is not None else None

    def fetchall(self):
        cols = self._columns()
        return [_Row(zip(cols, row)) for row in self._cursor.fetchall()]


class _DB:
    """Thin wrapper so libsql rows support dict-style access like sqlite3.Row."""
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        return _Cursor(self._conn.execute(sql, params))

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def _base_dir():
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def _data_dir():
    base = os.path.dirname(os.path.abspath(__file__)) if not getattr(sys, "frozen", False) else os.path.dirname(sys.executable)
    return os.path.join(base, "data")


BASE_DIR = _base_dir()
DATA_DIR = _data_dir()

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"), static_url_path="")

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "gemeas0609")
_admin_tokens = set()

DEFAULT_GIFTS = [
    # (id, name, value, category)
    ("acessorios-chupetas", "Chupetas (2 unidades)", 50, "acessorios"),
    ("acessorios-prendedores-chupeta", "Prendedores de chupeta (4 unidades)", 60, "acessorios"),

    ("alim-escova-mamadeiras-1", "Escova para mamadeiras (1 unidade)", 40, "alimentacao"),
    ("alim-escova-mamadeiras-2", "Escova para mamadeiras (1 unidade)", 40, "alimentacao"),
    ("alim-bicos-extras-1", "Bicos extras para mamadeira (4 unidades)", 50, "alimentacao"),
    ("alim-bicos-extras-2", "Bicos extras para mamadeira (4 unidades)", 50, "alimentacao"),
    ("alim-bicos-extras-3", "Bicos extras para mamadeira (4 unidades)", 50, "alimentacao"),
    ("alim-kit-mamadeiras-1", "Kit Mamadeiras 1 (2 mamadeiras 60ml + 1 escova)", 180, "alimentacao"),
    ("alim-kit-mamadeiras-2", "Kit Mamadeiras 2 (2 mamadeiras 60ml + 1 escova)", 180, "alimentacao"),
    ("alim-kit-mamadeiras-3", "Kit Mamadeiras 3 (2 mamadeiras 150ml + 2 bicos extras)", 180, "alimentacao"),
    ("alim-kit-mamadeiras-4", "Kit Mamadeiras 4 (2 mamadeiras 150ml + 2 bicos extras)", 180, "alimentacao"),
    ("alim-kit-mamadeiras-5", "Kit Mamadeiras 5 (2 mamadeiras 240ml + 2 bicos extras)", 200, "alimentacao"),
    ("alim-kit-mamadeiras-6", "Kit Mamadeiras 6 (2 mamadeiras 240ml + 2 bicos extras)", 200, "alimentacao"),
    ("alim-kit-alimentacao-1", "Kit Alimentação 1 (porta-leite em pó + porta-mamadeira térmico)", 180, "alimentacao"),
    ("alim-kit-alimentacao-2", "Kit Alimentação 2 (porta-leite em pó + porta-mamadeira térmico)", 180, "alimentacao"),
    ("alim-garrafas-termicas", "Garrafas térmicas (2 unidades)", 180, "alimentacao"),
    ("alim-almofada-amamentacao", "Almofada de amamentação para gêmeos", 400, "alimentacao"),
    ("alim-esterilizador", "Esterilizador de mamadeiras", 500, "alimentacao"),
    ("alim-aquecedor", "Aquecedor de mamadeiras", 450, "alimentacao"),

    ("higiene-shampoo-1", "Shampoo (1 unidade)", 40, "higiene"),
    ("higiene-shampoo-2", "Shampoo (1 unidade)", 40, "higiene"),
    ("higiene-sabonete-1", "Sabonete líquido (1 unidade)", 40, "higiene"),
    ("higiene-sabonete-2", "Sabonete líquido (1 unidade)", 40, "higiene"),
    ("higiene-creme-assadura-1", "Creme para assadura (1 unidade)", 50, "higiene"),
    ("higiene-creme-assadura-2", "Creme para assadura (1 unidade)", 50, "higiene"),
    ("higiene-hidratante-1", "Hidratante (1 unidade)", 50, "higiene"),
    ("higiene-hidratante-2", "Hidratante (1 unidade)", 50, "higiene"),
    ("higiene-oleo-corporal-1", "Óleo corporal (1 unidade)", 50, "higiene"),
    ("higiene-oleo-corporal-2", "Óleo corporal (1 unidade)", 50, "higiene"),
    ("higiene-algodao-1", "Algodão (2 pacotes)", 50, "higiene"),
    ("higiene-algodao-2", "Algodão (2 pacotes)", 50, "higiene"),
    ("higiene-algodao-3", "Algodão (2 pacotes)", 50, "higiene"),
    ("higiene-algodao-4", "Algodão (2 pacotes)", 50, "higiene"),
    ("higiene-algodao-5", "Algodão (2 pacotes)", 50, "higiene"),
    ("higiene-lencos-umedecidos-1", "Lenços umedecidos (5 pacotes)", 75, "higiene"),
    ("higiene-lencos-umedecidos-2", "Lenços umedecidos (5 pacotes)", 75, "higiene"),
    ("higiene-lencos-umedecidos-3", "Lenços umedecidos (5 pacotes)", 75, "higiene"),
    ("higiene-lencos-umedecidos-4", "Lenços umedecidos (5 pacotes)", 75, "higiene"),
    ("higiene-lencos-umedecidos-5", "Lenços umedecidos (5 pacotes)", 75, "higiene"),
    ("higiene-lencos-umedecidos-6", "Lenços umedecidos (5 pacotes)", 75, "higiene"),
    ("higiene-aspirador-nasal-1", "Aspirador nasal (1 unidade)", 90, "higiene"),
    ("higiene-aspirador-nasal-2", "Aspirador nasal (1 unidade)", 90, "higiene"),
    ("higiene-termometro-digital", "Termômetro digital", 180, "higiene"),
    ("higiene-inalador", "Inalador", 250, "higiene"),

    ("roupa-toucas-1", "Toucas (2 unidades)", 60, "roupinhas"),
    ("roupa-toucas-2", "Toucas (2 unidades)", 60, "roupinhas"),
    ("roupa-luvas-rn-1", "Luvas RN (2 pares)", 60, "roupinhas"),
    ("roupa-luvas-rn-2", "Luvas RN (2 pares)", 60, "roupinhas"),
    ("roupa-bodies-rn-1", "Bodies RN (3 unidades)", 150, "roupinhas"),
    ("roupa-bodies-rn-2", "Bodies RN (3 unidades)", 150, "roupinhas"),
    ("roupa-bodies-rn-3", "Bodies RN (3 unidades)", 150, "roupinhas"),
    ("roupa-bodies-rn-4", "Bodies RN (3 unidades)", 150, "roupinhas"),
    ("roupa-bodies-p-1", "Bodies P (3 unidades)", 150, "roupinhas"),
    ("roupa-bodies-p-2", "Bodies P (3 unidades)", 150, "roupinhas"),
    ("roupa-bodies-p-3", "Bodies P (3 unidades)", 150, "roupinhas"),
    ("roupa-bodies-p-4", "Bodies P (3 unidades)", 150, "roupinhas"),
    ("roupa-macacoes-rn-1", "Macacões RN (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-rn-2", "Macacões RN (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-rn-3", "Macacões RN (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-rn-4", "Macacões RN (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-rn-5", "Macacões RN (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-rn-6", "Macacões RN (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-p-1", "Macacões P (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-p-2", "Macacões P (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-p-3", "Macacões P (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-p-4", "Macacões P (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-p-5", "Macacões P (2 unidades)", 180, "roupinhas"),
    ("roupa-macacoes-p-6", "Macacões P (2 unidades)", 180, "roupinhas"),
    ("roupa-calcas-mijao-1", "Calças mijão (3 unidades)", 150, "roupinhas"),
    ("roupa-calcas-mijao-2", "Calças mijão (3 unidades)", 150, "roupinhas"),
    ("roupa-calcas-mijao-3", "Calças mijão (3 unidades)", 150, "roupinhas"),
    ("roupa-calcas-mijao-4", "Calças mijão (3 unidades)", 150, "roupinhas"),
    ("roupa-meias-1", "Meias (6 pares)", 150, "roupinhas"),
    ("roupa-meias-2", "Meias (6 pares)", 150, "roupinhas"),
    ("roupa-casaquinhos-1", "Casaquinhos (2 unidades)", 280, "roupinhas"),
    ("roupa-casaquinhos-2", "Casaquinhos (2 unidades)", 280, "roupinhas"),
    ("roupa-pijamas-1", "Pijamas (2 unidades)", 300, "roupinhas"),
    ("roupa-pijamas-2", "Pijamas (2 unidades)", 300, "roupinhas"),
    ("roupa-saidas-maternidade-1", "Saídas de maternidade (2 unidades)", 300, "roupinhas"),
    ("roupa-saidas-maternidade-2", "Saídas de maternidade (2 unidades)", 300, "roupinhas"),

    ("enxoval-babadores-1", "Babadores (2 unidades)", 70, "enxoval"),
    ("enxoval-babadores-2", "Babadores (2 unidades)", 70, "enxoval"),
    ("enxoval-babadores-3", "Babadores (2 unidades)", 70, "enxoval"),
    ("enxoval-babadores-4", "Babadores (2 unidades)", 70, "enxoval"),
    ("enxoval-mantas-1", "Mantas (3 unidades)", 180, "enxoval"),
    ("enxoval-mantas-2", "Mantas (3 unidades)", 180, "enxoval"),
    ("enxoval-fraldas-boca-1", "Fraldas de boca (6 unidades)", 150, "enxoval"),
    ("enxoval-fraldas-boca-2", "Fraldas de boca (6 unidades)", 150, "enxoval"),
    ("enxoval-panos-ombro-1", "Panos de ombro (6 unidades)", 150, "enxoval"),
    ("enxoval-panos-ombro-2", "Panos de ombro (6 unidades)", 150, "enxoval"),

    ("banho-banheira", "Banheira", 300, "banho-troca"),
    ("banho-suporte", "Suporte para banheira", 300, "banho-troca"),
    ("banho-trocador", "Trocador", 280, "banho-troca"),
    ("banho-capas-trocador-1", "Capas para trocador (2 unidades)", 120, "banho-troca"),
    ("banho-capas-trocador-2", "Capas para trocador (2 unidades)", 120, "banho-troca"),
    ("banho-trocador-impermeavel", "Trocador impermeável", 180, "banho-troca"),
    ("banho-toalhas-capuz", "Toalhas com capuz (2 unidades)", 180, "banho-troca"),
    ("banho-toalhas-fralda-1", "Toalhas-fralda (6 unidades)", 180, "banho-troca"),
    ("banho-toalhas-fralda-2", "Toalhas-fralda (6 unidades)", 180, "banho-troca"),
    ("banho-termometro", "Termômetro para banho", 120, "banho-troca"),
    ("banho-kit-higiene-1", "Kit Higiene 1 (escova, pente e cortador de unhas)", 120, "banho-troca"),
    ("banho-kit-higiene-2", "Kit Higiene 2 (escova, pente e cortador de unhas)", 120, "banho-troca"),

    ("quarto-berco-1", "Berço", 1300, "quarto"),
    ("quarto-berco-2", "Berço", 1300, "quarto"),
    ("quarto-colchao-1", "Colchão para berço", 350, "quarto"),
    ("quarto-colchao-2", "Colchão para berço", 350, "quarto"),
    ("quarto-lencois-1", "Jogos de lençol para berço (2 unidades)", 300, "quarto"),
    ("quarto-lencois-2", "Jogos de lençol para berço (2 unidades)", 300, "quarto"),
    ("quarto-protetores-1", "Protetores impermeáveis para colchão (2 unidades)", 300, "quarto"),
    ("quarto-protetores-2", "Protetores impermeáveis para colchão (2 unidades)", 300, "quarto"),
    ("quarto-berco-portatil", "Berço portátil (Pack and Play)", 900, "quarto"),
    ("quarto-comoda", "Cômoda", 1800, "quarto"),
    ("quarto-baba-eletronica", "Babá eletrônica", 900, "quarto"),
    ("quarto-ruido-branco", "Máquina de ruído branco", 450, "quarto"),

    ("passeio-bebe-conforto-1", "Bebê-conforto", 1000, "passeio-descanso"),
    ("passeio-bebe-conforto-2", "Bebê-conforto", 1000, "passeio-descanso"),
    ("passeio-cadeirinha-auto-1", "Cadeirinha para automóvel", 1100, "passeio-descanso"),
    ("passeio-cadeirinha-auto-2", "Cadeirinha para automóvel", 1100, "passeio-descanso"),
    ("passeio-cadeira-balanco-1", "Cadeira de balanço elétrica", 1200, "passeio-descanso"),
    ("passeio-cadeira-balanco-2", "Cadeira de balanço elétrica", 1200, "passeio-descanso"),
    ("passeio-canguru", "Canguru ergonômico", 450, "passeio-descanso"),
    ("passeio-mochila-maternidade", "Mochila maternidade", 350, "passeio-descanso"),
    ("passeio-carrinho-duplo", "Carrinho de bebê duplo", 2000, "passeio-descanso"),

    ("fralda-rn", "Fraldas RN (2 pacotes)", 150, "fraldas"),
    ("fralda-p", "Fraldas P (2 pacotes)", 150, "fraldas"),
    ("fralda-m-1", "Fraldas M (2 pacotes)", 170, "fraldas"),
    ("fralda-m-2", "Fraldas M (2 pacotes)", 170, "fraldas"),
    ("fralda-g-1", "Fraldas G (2 pacotes)", 180, "fraldas"),
    ("fralda-g-2", "Fraldas G (2 pacotes)", 180, "fraldas"),
    ("fralda-xg", "Fraldas XG (2 pacotes)", 180, "fraldas"),

    ("dinheiro-presente", "Presente em dinheiro", None, "dinheiro"),
]


def _ensure_default_gifts(db):
    count = db.execute("SELECT COUNT(*) FROM gifts").fetchone()[0]
    if count == 0:
        for gift_id, name, value, category in DEFAULT_GIFTS:
            db.execute(
                "INSERT INTO gifts (id, name, value, category) VALUES (?, ?, ?, ?)",
                (gift_id, name, value, category),
            )
        db.commit()


def get_db():
    if "db" not in g:
        if TURSO_DATABASE_URL:
            raw = libsql.connect(database=TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN or "")
        else:
            os.makedirs(DATA_DIR, exist_ok=True)
            raw = libsql.connect(os.path.join(DATA_DIR, "cha.db"))
        db = _DB(raw)
        if not TURSO_DATABASE_URL:
            db.execute("PRAGMA journal_mode=WAL")
        db.execute("""
            CREATE TABLE IF NOT EXISTS gifts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                value REAL,
                category TEXT NOT NULL DEFAULT ''
            )
        """)
        try:
            db.execute("ALTER TABLE gifts ADD COLUMN category TEXT NOT NULL DEFAULT ''")
            db.commit()
        except ValueError:
            pass
        db.execute("""
            CREATE TABLE IF NOT EXISTS reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gift_id TEXT NOT NULL,
                guest_name TEXT NOT NULL,
                amount REAL NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE CASCADE
            )
        """)
        res_cols = [c["name"] for c in db.execute("PRAGMA table_info(reservations)").fetchall()]
        if res_cols and "id" not in res_cols:
            # Old schema had gift_id as PRIMARY KEY (one reservation per gift).
            # Migrate so repeatable categories (e.g. fraldas) can have many.
            db.execute("ALTER TABLE reservations RENAME TO reservations_old")
            db.execute("""
                CREATE TABLE reservations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    gift_id TEXT NOT NULL,
                    guest_name TEXT NOT NULL,
                    amount REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE CASCADE
                )
            """)
            db.execute("""
                INSERT INTO reservations (gift_id, guest_name, amount, created_at)
                SELECT gift_id, guest_name, amount, created_at FROM reservations_old
            """)
            db.execute("DROP TABLE reservations_old")
            db.commit()
        db.execute("""
            CREATE TABLE IF NOT EXISTS rsvps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                people INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        db.commit()
        _ensure_default_gifts(db)
        g.db = db
    return g.db


@app.teardown_appcontext
def close_db(_exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@app.route("/api/reservations", methods=["GET"])
def get_reservations():
    rows = get_db().execute("SELECT gift_id FROM reservations").fetchall()
    return jsonify({r["gift_id"]: True for r in rows})


@app.route("/api/reservations", methods=["POST"])
def save_reservation():
    payload = request.get_json(silent=True) or {}
    gift_id = payload.get("gift_id")
    guest_name = payload.get("guest_name")
    amount = payload.get("amount")

    if not gift_id or not guest_name or not amount:
        return jsonify({"error": "Campos gift_id, guest_name e amount sao obrigatorios"}), 400

    db = get_db()
    db.execute(
        "INSERT INTO reservations (gift_id, guest_name, amount, created_at) VALUES (?, ?, ?, ?)",
        (gift_id, guest_name, amount, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()

    return get_reservations()


@app.route("/api/rsvps", methods=["GET"])
def get_rsvps():
    rows = get_db().execute("SELECT name, people, created_at FROM rsvps ORDER BY id").fetchall()
    entries = [{"name": r["name"], "people": r["people"], "date": r["created_at"]} for r in rows]
    return jsonify({"entries": entries})


@app.route("/api/rsvps", methods=["POST"])
def save_rsvp():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name")
    people = payload.get("people", 1)

    if not name:
        return jsonify({"error": "Campo name e obrigatorio"}), 400

    db = get_db()
    db.execute(
        "INSERT INTO rsvps (name, people, created_at) VALUES (?, ?, ?)",
        (name, int(people) or 1, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return get_rsvps()


def _require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = (request.headers.get("Authorization") or "").removeprefix("Bearer ")
        if not token or token not in _admin_tokens:
            return jsonify({"error": "Nao autorizado"}), 401
        return f(*args, **kwargs)
    return wrapper


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    payload = request.get_json(silent=True) or {}
    if payload.get("password") != ADMIN_PASSWORD:
        return jsonify({"error": "Senha incorreta"}), 401
    token = secrets.token_urlsafe(32)
    _admin_tokens.add(token)
    return jsonify({"token": token})


@app.route("/api/admin/dashboard", methods=["GET"])
@_require_admin
def admin_dashboard():
    db = get_db()
    res_rows = db.execute(
        "SELECT id, gift_id, guest_name, amount, created_at FROM reservations ORDER BY created_at"
    ).fetchall()
    rsvp_rows = db.execute(
        "SELECT id, name, people, created_at FROM rsvps ORDER BY created_at"
    ).fetchall()
    return jsonify({
        "reservations": [
            {
                "id": r["id"],
                "gift_id": r["gift_id"],
                "guest_name": r["guest_name"],
                "amount": r["amount"],
                "created_at": r["created_at"],
            }
            for r in res_rows
        ],
        "rsvps": [
            {
                "id": r["id"],
                "name": r["name"],
                "people": r["people"],
                "created_at": r["created_at"],
            }
            for r in rsvp_rows
        ],
    })


@app.route("/api/admin/reservations", methods=["POST"])
@_require_admin
def admin_create_reservation():
    payload = request.get_json(silent=True) or {}
    gift_id = payload.get("gift_id")
    guest_name = payload.get("guest_name")
    amount = payload.get("amount")

    if not gift_id or not guest_name or not amount:
        return jsonify({"error": "Campos gift_id, guest_name e amount sao obrigatorios"}), 400

    db = get_db()
    db.execute(
        "INSERT INTO reservations (gift_id, guest_name, amount, created_at) VALUES (?, ?, ?, ?)",
        (gift_id, guest_name, amount, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/admin/reservations/<int:res_id>", methods=["DELETE"])
@_require_admin
def admin_delete_reservation(res_id):
    db = get_db()
    db.execute("DELETE FROM reservations WHERE id = ?", (res_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/admin/rsvps/<int:rsvp_id>", methods=["DELETE"])
@_require_admin
def admin_delete_rsvp(rsvp_id):
    db = get_db()
    db.execute("DELETE FROM rsvps WHERE id = ?", (rsvp_id,))
    db.commit()
    return jsonify({"ok": True})


def _gift_response(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "value": row["value"],
        "category": row["category"],
    }


@app.route("/api/gifts", methods=["GET"])
def get_gifts():
    db = get_db()
    rows = db.execute("SELECT id, name, value, category FROM gifts ORDER BY id").fetchall()
    return jsonify({"gifts": [_gift_response(r) for r in rows]})


@app.route("/api/admin/gifts", methods=["POST"])
@_require_admin
def admin_create_gift():
    name = request.form.get("name", "").strip()
    value_field = request.form.get("value", "").strip()
    value = float(value_field.replace(",", ".")) if value_field else None
    category = request.form.get("category", "").strip()

    if not name:
        return jsonify({"error": "Nome do presente e obrigatorio"}), 400

    gift_id = request.form.get("id", "").strip().lower()
    if not gift_id:
        gift_id = uuid.uuid4().hex[:8]

    db = get_db()
    try:
        db.execute(
            "INSERT INTO gifts (id, name, value, category) VALUES (?, ?, ?, ?)",
            (gift_id, name, value, category),
        )
    except ValueError:
        return jsonify({"error": "Ja existe um presente com esse id"}), 409

    db.commit()
    row = db.execute("SELECT id, name, value, category FROM gifts WHERE id = ?", (gift_id,)).fetchone()
    return jsonify(_gift_response(row)), 201


@app.route("/api/admin/gifts/<gift_id>", methods=["PUT"])
@_require_admin
def admin_update_gift(gift_id):
    name = request.form.get("name", "").strip()
    value_field = request.form.get("value", "").strip()
    value = float(value_field.replace(",", ".")) if value_field else None
    category = request.form.get("category", "").strip()

    if not name:
        return jsonify({"error": "Nome do presente e obrigatorio"}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM gifts WHERE id = ?", (gift_id,)).fetchone()
    if not existing:
        return jsonify({"error": "Presente nao encontrado"}), 404

    db.execute("UPDATE gifts SET name = ?, value = ?, category = ? WHERE id = ?", (name, value, category, gift_id))

    db.commit()
    row = db.execute("SELECT id, name, value, category FROM gifts WHERE id = ?", (gift_id,)).fetchone()
    return jsonify(_gift_response(row))


@app.route("/api/admin/gifts/<gift_id>", methods=["DELETE"])
@_require_admin
def admin_delete_gift(gift_id):
    db = get_db()
    db.execute("DELETE FROM gifts WHERE id = ?", (gift_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def static_files(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    has_static_build = os.path.exists(os.path.join(app.static_folder, "index.html"))

    if port == 5000 and has_static_build:
        def open_browser():
            webbrowser.open(f"http://localhost:{port}")

        threading.Timer(1.0, open_browser).start()
        print(f"\n  Cha de Bebe — Sarah Brandao")
        print(f"  http://localhost:{port}\n")
    elif port == 5000:
        print(f"\n  Cha de Bebe — Sarah Brandao (backend/API)")
        print(f"  API rodando em http://localhost:{port}")
        print(f"  Abra o site em http://localhost:5173\n")
    else:
        print(f"\n  Cha de Bebe — Sarah Brandao")
        print(f"  http://localhost:{port}\n")

    app.run(debug=False, host="0.0.0.0", port=port)
