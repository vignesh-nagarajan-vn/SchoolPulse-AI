from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import init_database


def main() -> None:
    init_database()
    print("Initialized SQLite database from synthetic CSV files.")


if __name__ == "__main__":
    main()
