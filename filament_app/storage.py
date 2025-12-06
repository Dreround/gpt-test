import json
import os
from pathlib import Path
from typing import Any, Dict

DEFAULT_DATA: Dict[str, Any] = {
    "spools": [],
    "print_logs": [],
    "purchases": [],
    "config": {
        "low_stock_threshold": 200.0,
        "max_open_days": 90,
        "weight_unit": "g",
    },
}


def _data_file() -> Path:
    custom_path = os.environ.get("FILAMENT_APP_DB")
    if custom_path:
        return Path(custom_path).expanduser()
    repo_root = Path(__file__).resolve().parent.parent
    return repo_root / "data" / "filament_data.json"


def _ensure_data_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        with path.open("w", encoding="utf-8") as handle:
            json.dump(DEFAULT_DATA, handle, indent=2)


def load_data() -> Dict[str, Any]:
    path = _data_file()
    _ensure_data_file(path)
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_data(data: Dict[str, Any]) -> None:
    path = _data_file()
    _ensure_data_file(path)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
