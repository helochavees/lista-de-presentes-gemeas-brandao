import os
import sys
import uuid
import secrets
import sqlite3
import webbrowser
import threading
from datetime import datetime, timezone
from functools import wraps
from flask import Flask, request, jsonify, g, send_from_directory


def _base_dir():
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def _data_dir():
    base = os.path.dirname(os.path.abspath(__file__)) if not getattr(sys, "frozen", False) else os.path.dirname(sys.executable)
    return os.path.join(base, "data")


BASE_DIR = _base_dir()
DATA_DIR = _data_dir()
PHOTOS_DIR = os.path.join(DATA_DIR, "gifts")

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"), static_url_path="")

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
_admin_tokens = set()

DEFAULT_GIFTS = [
    ("fralda-rn", "Pacote de fraldas RN", 60),
    ("fralda-p", "Pacote de fraldas P", 60),
    ("fralda-m", "Pacote de fraldas M", 65),
    ("bodies", "Kit de bodies", 90),
    ("manta", "Manta de tricô", 120),
    ("banho", "Kit banho da bebê", 150),
    ("trocador", "Trocador & pomadas", 80),
    ("higiene", "Kit higiene", 70),
    ("naninha", "Naninha", 55),
    ("mobile", "Mobile para o berço", 85),
    ("carrinho", "Cota do carrinho", 200),
    ("berco", "Cota do berço", 250),
    ("livre", "Mimo à sua escolha", None),
]


def _photo_path(gift_id: str):
    return os.path.join(PHOTOS_DIR, f"{gift_id}.jpg")


def _ensure_default_gifts(db):
    count = db.execute("SELECT COUNT(*) FROM gifts").fetchone()[0]
    if count == 0:
        for gift_id, name, value in DEFAULT_GIFTS:
            db.execute(
                "INSERT INTO gifts (id, name, value) VALUES (?, ?, ?)",
                (gift_id, name, value),
            )
        db.commit()


def get_db():
    if "db" not in g:
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(PHOTOS_DIR, exist_ok=True)
        db = sqlite3.connect(os.path.join(DATA_DIR, "cha.db"))
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("""
            CREATE TABLE IF NOT EXISTS gifts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                value REAL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS reservations (
                gift_id TEXT PRIMARY KEY,
                guest_name TEXT NOT NULL,
                amount REAL NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE CASCADE
            )
        """)
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
    rows = get_db().execute("SELECT gift_id, guest_name, amount, created_at FROM reservations").fetchall()
    result = {}
    for r in rows:
        result[r["gift_id"]] = {
            "name": r["guest_name"],
            "amount": r["amount"],
            "date": r["created_at"],
        }
    return jsonify(result)


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
        "INSERT OR REPLACE INTO reservations (gift_id, guest_name, amount, created_at) VALUES (?, ?, ?, ?)",
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
        "SELECT gift_id, guest_name, amount, created_at FROM reservations ORDER BY created_at"
    ).fetchall()
    rsvp_rows = db.execute(
        "SELECT id, name, people, created_at FROM rsvps ORDER BY created_at"
    ).fetchall()
    return jsonify({
        "reservations": [
            {
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
        "INSERT OR REPLACE INTO reservations (gift_id, guest_name, amount, created_at) VALUES (?, ?, ?, ?)",
        (gift_id, guest_name, amount, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/admin/reservations/<gift_id>", methods=["DELETE"])
@_require_admin
def admin_delete_reservation(gift_id):
    db = get_db()
    db.execute("DELETE FROM reservations WHERE gift_id = ?", (gift_id,))
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
        "photo_url": f"/api/gifts/{row['id']}/photo" if os.path.exists(_photo_path(row["id"])) else None,
    }


@app.route("/api/gifts", methods=["GET"])
def get_gifts():
    db = get_db()
    rows = db.execute("SELECT id, name, value FROM gifts ORDER BY id").fetchall()
    return jsonify({"gifts": [_gift_response(r) for r in rows]})


@app.route("/api/gifts/<gift_id>/photo", methods=["GET"])
def get_gift_photo(gift_id):
    path = _photo_path(gift_id)
    if not os.path.exists(path):
        return jsonify({"error": "Foto nao encontrada"}), 404
    return send_from_directory(PHOTOS_DIR, f"{gift_id}.jpg")


@app.route("/api/admin/gifts", methods=["POST"])
@_require_admin
def admin_create_gift():
    name = request.form.get("name", "").strip()
    value_field = request.form.get("value", "").strip()
    value = float(value_field.replace(",", ".")) if value_field else None

    if not name:
        return jsonify({"error": "Nome do presente e obrigatorio"}), 400

    gift_id = request.form.get("id", "").strip().lower()
    if not gift_id:
        gift_id = uuid.uuid4().hex[:8]

    db = get_db()
    try:
        db.execute("INSERT INTO gifts (id, name, value) VALUES (?, ?, ?)", (gift_id, name, value))
    except sqlite3.IntegrityError:
        return jsonify({"error": "Ja existe um presente com esse id"}), 409

    photo = request.files.get("photo")
    if photo and photo.filename and photo.content_type and photo.content_type.startswith("image/"):
        photo.save(_photo_path(gift_id))

    db.commit()
    row = db.execute("SELECT id, name, value FROM gifts WHERE id = ?", (gift_id,)).fetchone()
    return jsonify(_gift_response(row)), 201


@app.route("/api/admin/gifts/<gift_id>", methods=["PUT"])
@_require_admin
def admin_update_gift(gift_id):
    name = request.form.get("name", "").strip()
    value_field = request.form.get("value", "").strip()
    value = float(value_field.replace(",", ".")) if value_field else None

    if not name:
        return jsonify({"error": "Nome do presente e obrigatorio"}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM gifts WHERE id = ?", (gift_id,)).fetchone()
    if not existing:
        return jsonify({"error": "Presente nao encontrado"}), 404

    db.execute("UPDATE gifts SET name = ?, value = ? WHERE id = ?", (name, value, gift_id))

    photo = request.files.get("photo")
    if photo and photo.filename and photo.content_type and photo.content_type.startswith("image/"):
        photo.save(_photo_path(gift_id))

    db.commit()
    row = db.execute("SELECT id, name, value FROM gifts WHERE id = ?", (gift_id,)).fetchone()
    return jsonify(_gift_response(row))


@app.route("/api/admin/gifts/<gift_id>/photo", methods=["DELETE"])
@_require_admin
def admin_delete_gift_photo(gift_id):
    path = _photo_path(gift_id)
    if os.path.exists(path):
        os.remove(path)
    return jsonify({"ok": True})


@app.route("/api/admin/gifts/<gift_id>", methods=["DELETE"])
@_require_admin
def admin_delete_gift(gift_id):
    db = get_db()
    db.execute("DELETE FROM gifts WHERE id = ?", (gift_id,))
    db.commit()
    path = _photo_path(gift_id)
    if os.path.exists(path):
        os.remove(path)
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
    port = 5000

    def open_browser():
        webbrowser.open(f"http://localhost:{port}")

    threading.Timer(1.0, open_browser).start()

    print(f"\n  Cha de Bebe — Sarah Brandao")
    print(f"  http://localhost:{port}\n")
    app.run(debug=False, port=port)