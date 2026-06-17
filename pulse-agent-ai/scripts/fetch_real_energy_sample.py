from __future__ import annotations

import argparse
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw"

BDG2_METADATA_URL = "https://media.githubusercontent.com/media/buds-lab/building-data-genome-project-2/master/data/metadata/metadata.csv"
BDG2_ELECTRICITY_URL = "https://media.githubusercontent.com/media/buds-lab/building-data-genome-project-2/master/data/meters/cleaned/electricity_cleaned.csv"


def download_metadata() -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / "bdg2_metadata.csv"
    response = requests.get(BDG2_METADATA_URL, timeout=60)
    response.raise_for_status()
    target.write_bytes(response.content)
    return target


def download_electricity_sample(max_rows: int) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / "bdg2_electricity_sample.csv"
    with requests.get(BDG2_ELECTRICITY_URL, stream=True, timeout=120) as response:
        response.raise_for_status()
        with target.open("wb") as handle:
            for index, line in enumerate(response.iter_lines(keepends=True)):
                if index > max_rows:
                    break
                handle.write(line)
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch a small real-data sample from Building Data Genome 2.")
    parser.add_argument("--max-rows", type=int, default=500, help="Rows of hourly electricity data to keep.")
    parser.add_argument("--metadata-only", action="store_true", help="Only download building metadata.")
    args = parser.parse_args()

    metadata_path = download_metadata()
    print(f"Downloaded metadata: {metadata_path}")
    if not args.metadata_only:
        sample_path = download_electricity_sample(args.max_rows)
        print(f"Downloaded electricity sample: {sample_path}")


if __name__ == "__main__":
    main()

