"""
Script de build — gera executavel standalone.
Rode com: python build.py
O executavel sai em: dist/
"""

import os
import sys
import shutil
import subprocess
import platform

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
FRONTEND = os.path.join(ROOT, "frontend")
DIST_DIR = os.path.join(ROOT, "dist")
STATIC_DIR = os.path.join(BACKEND, "static")
VENV_DIR = os.path.join(ROOT, ".venv")

APP_NAME = "Cha-de-Bebe"
IS_WINDOWS = platform.system() == "Windows"
SEP = ";" if IS_WINDOWS else ":"
EXE_EXT = ".exe" if IS_WINDOWS else ""
PYTHON = os.path.join(VENV_DIR, "Scripts" if IS_WINDOWS else "bin", "python") + (".exe" if IS_WINDOWS else "")
PIP = os.path.join(VENV_DIR, "Scripts" if IS_WINDOWS else "bin", "pip") + (".exe" if IS_WINDOWS else "")


def run(cmd, cwd=None):
    print(f"  $ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd, check=True)


def main():
    print("=" * 60)
    print(f"  Buildando {APP_NAME} para {platform.system()}")
    print("=" * 60)

    # 1. Virtual env limpo (so flask + pyinstaller)
    if not os.path.exists(VENV_DIR):
        print("\n[0/3] Criando ambiente virtual limpo...")
        run([sys.executable, "-m", "venv", VENV_DIR])
        run([PIP, "install", "--upgrade", "pip"], cwd=ROOT)
        run([PIP, "install", "flask", "pyinstaller"], cwd=ROOT)
    else:
        print("\n[0/3] Ambiente virtual ja existe — pulando...")

    # 2. Build do frontend
    print("\n[1/3] Build do frontend (Vite)...")
    run(["npm", "run", "build"], cwd=FRONTEND)

    # 3. Copia dist/ → static/
    print("\n[2/3] Copiando frontend para static/...")
    if os.path.exists(STATIC_DIR):
        shutil.rmtree(STATIC_DIR)
    shutil.copytree(os.path.join(FRONTEND, "dist"), STATIC_DIR)
    print("  OK")

    # 4. PyInstaller
    print("\n[3/3] PyInstaller — gerando executavel...")
    pyi_args = [
        PYTHON, "-m", "PyInstaller",
        "--onefile",
        "--name", APP_NAME,
        "--add-data", f"static{SEP}static",
        "--clean",
        "--noconfirm",
        "app.py",
    ]
    run(pyi_args, cwd=BACKEND)

    # 5. Move .exe pra dist/ e limpa
    print("\n  Movendo executavel para dist/ ...")
    os.makedirs(DIST_DIR, exist_ok=True)
    exe_name = APP_NAME + EXE_EXT
    src = os.path.join(BACKEND, "dist", exe_name)
    dst = os.path.join(DIST_DIR, exe_name)
    if os.path.exists(dst):
        os.remove(dst)
    shutil.move(src, dst)

    # Limpa build artifacts
    for d in ["build", "__pycache__"]:
        p = os.path.join(BACKEND, d)
        if os.path.exists(p):
            shutil.rmtree(p)
    spec = os.path.join(BACKEND, f"{APP_NAME}.spec")
    if os.path.exists(spec):
        os.remove(spec)

    print(f"\n  PRONTO! Executavel em: {dst}")
    print(f"  Tamanho: {os.path.getsize(dst) / (1024*1024):.1f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()