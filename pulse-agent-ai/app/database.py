from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

from .config import DATABASE_PATH, SYNTHETIC_DIR


TABLE_FILES = {
    "energy_logs": "energy_logs.csv",
    "event_plans": "event_plans.csv",
    "water_alerts": "water_alerts.csv",
    "waste_logs": "waste_logs.csv",
    "transport_plans": "transport_plans.csv",
}


def get_connection(db_path: Path = DATABASE_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def init_database(db_path: Path = DATABASE_PATH, synthetic_dir: Path = SYNTHETIC_DIR) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with get_connection(db_path) as connection:
        for table, filename in TABLE_FILES.items():
            csv_path = synthetic_dir / filename
            if not csv_path.exists():
                continue
            frame = pd.read_csv(csv_path)
            frame.to_sql(table, connection, if_exists="replace", index=False)
        connection.execute("CREATE INDEX IF NOT EXISTS idx_energy_timestamp ON energy_logs(timestamp)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_energy_zone ON energy_logs(zone)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_water_status ON water_alerts(status)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_waste_event ON waste_logs(event_id)")
        connection.commit()


def ensure_database() -> None:
    if not DATABASE_PATH.exists():
        init_database()


def fetch_all(table: str) -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(f"SELECT * FROM {table}").fetchall()
    return [dict(row) for row in rows]

