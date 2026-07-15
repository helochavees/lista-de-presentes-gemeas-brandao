import os
import sys
import sqlite3
import webbrowser
import threading
from datetime import datetime, timezone
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

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"), static_url_path="")


def get_db():
    if "db" not in g:
        os.makedirs(DATA_DIR, exist_ok=True)
        db = sqlite3.connect(os.path.join(DATA_DIR, "cha.db"))
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("""
            CREATE TABLE IF NOT EXISTS reservations (
                gift_id TEXT PRIMARY KEY,
                guest_name TEXT NOT NULL,
                amount REAL NOT NULL,
                created_at TEXT NOT NULL
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