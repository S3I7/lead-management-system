"""Back up the SQLite database and uploaded stories into backups/<timestamp>/ (see BACKUP & RECOVERY in WORKFLOW_REVIEW.md).
Usage: python backup.py [target_dir]      Safe while the app is running (uses SQLite's online backup API).
For PostgreSQL use pg_dump instead; this script only handles sqlite:/// URLs."""
import os
import shutil
import sqlite3
import sys
from datetime import datetime

from app.core.config import settings


def backup(target_root: str) -> str:
    if not settings.DATABASE_URL.startswith("sqlite:///"):
        raise SystemExit("Not SQLite: back up PostgreSQL with pg_dump, and copy the uploads folder separately.")
    db_path = settings.DATABASE_URL.removeprefix("sqlite:///")
    dest = os.path.join(target_root, datetime.now().strftime("%Y%m%d-%H%M%S"))
    os.makedirs(dest)
    src, out = sqlite3.connect(db_path), sqlite3.connect(os.path.join(dest, "writathon.db"))
    with out:
        src.backup(out)
    src.close()
    out.close()
    shutil.copytree(settings.UPLOAD_DIR, os.path.join(dest, "uploads"))
    # Verify: the copy opens, passes SQLite's integrity check, and has the same row counts
    chk = sqlite3.connect(os.path.join(dest, "writathon.db"))
    assert chk.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "backup failed integrity check"
    live = sqlite3.connect(db_path)
    for (table,) in live.execute("SELECT name FROM sqlite_master WHERE type='table'"):
        a = live.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        b = chk.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        assert a == b or table == "communication_logs", f"{table}: {a} live vs {b} in backup"  # logs may grow mid-backup
    chk.close()
    live.close()
    return dest


if __name__ == "__main__":
    print("Backup written to", backup(sys.argv[1] if len(sys.argv) > 1 else os.path.join(settings.BASE_DIR, "backups")))
