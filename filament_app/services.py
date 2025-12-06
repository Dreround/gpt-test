import datetime as dt
import uuid
from typing import Dict, List, Tuple

from .storage import DEFAULT_DATA, load_data, save_data


class SpoolNotFoundError(Exception):
    """Raised when a spool id cannot be located."""


def _find_spool(data: Dict, spool_id: str) -> Dict:
    for spool in data["spools"]:
        if spool["id"] == spool_id:
            return spool
    raise SpoolNotFoundError(f"No spool found with id {spool_id}")


def add_spool(
    *,
    brand: str,
    material: str,
    color: str,
    initial_weight: float,
    remaining_weight: float | None = None,
    opened_date: str | None = None,
) -> Dict:
    data = load_data()
    spool_id = str(uuid.uuid4())
    remaining = remaining_weight if remaining_weight is not None else initial_weight
    spool = {
        "id": spool_id,
        "brand": brand,
        "material": material,
        "color": color,
        "initial_weight": float(initial_weight),
        "remaining_weight": float(remaining),
        "opened_date": opened_date,
        "created_at": dt.date.today().isoformat(),
    }
    data["spools"].append(spool)
    save_data(data)
    return spool


def list_spools() -> List[Dict]:
    data = load_data()
    return data["spools"]


def record_print(
    spool_id: str, used_weight: float, note: str | None = None, date: str | None = None
) -> Dict:
    if used_weight <= 0:
        raise ValueError("Used weight must be greater than zero")

    data = load_data()
    spool = _find_spool(data, spool_id)
    new_remaining = max(spool["remaining_weight"] - used_weight, 0.0)
    spool["remaining_weight"] = new_remaining

    log_entry = {
        "spool_id": spool_id,
        "used_weight": float(used_weight),
        "date": (dt.date.fromisoformat(date) if date else dt.date.today()).isoformat(),
        "note": note,
    }
    data["print_logs"].append(log_entry)
    save_data(data)
    return log_entry


def add_purchase(
    *,
    brand: str,
    material: str,
    color: str,
    weight: float,
    cost: float,
    date: str | None = None,
) -> Dict:
    if weight <= 0 or cost < 0:
        raise ValueError("Weight must be positive and cost cannot be negative")

    data = load_data()
    purchase = {
        "id": str(uuid.uuid4()),
        "brand": brand,
        "material": material,
        "color": color,
        "weight": float(weight),
        "cost": float(cost),
        "date": (dt.date.fromisoformat(date) if date else dt.date.today()).isoformat(),
    }
    data["purchases"].append(purchase)
    save_data(data)
    return purchase


def set_config(*, low_stock_threshold: float | None = None, max_open_days: int | None = None, weight_unit: str | None = None) -> Dict:
    data = load_data()
    config = data.get("config", {})
    if low_stock_threshold is not None:
        if low_stock_threshold <= 0:
            raise ValueError("Low stock threshold must be greater than zero")
        config["low_stock_threshold"] = float(low_stock_threshold)
    if max_open_days is not None:
        if max_open_days <= 0:
            raise ValueError("Max open days must be greater than zero")
        config["max_open_days"] = int(max_open_days)
    if weight_unit:
        config["weight_unit"] = weight_unit
    data["config"] = config
    save_data(data)
    return config


def get_config() -> Dict:
    """Return config merged with defaults to avoid missing keys."""
    data = load_data()
    defaults = DEFAULT_DATA.get("config", {})
    config = {**defaults, **data.get("config", {})}
    return config


def _overdue_spools(spools: List[Dict], max_open_days: int) -> List[Tuple[Dict, int]]:
    today = dt.date.today()
    overdue: List[Tuple[Dict, int]] = []
    for spool in spools:
        opened_str = spool.get("opened_date")
        if not opened_str:
            continue
        try:
            opened_date = dt.date.fromisoformat(opened_str)
        except ValueError:
            continue
        days_open = (today - opened_date).days
        if days_open > max_open_days:
            overdue.append((spool, days_open))
    return overdue


def reminders() -> Dict[str, List[Dict]]:
    data = load_data()
    config = data.get("config", {})
    threshold = float(config.get("low_stock_threshold", 200.0))
    max_open = int(config.get("max_open_days", 90))

    low_stock = [spool for spool in data["spools"] if spool.get("remaining_weight", 0) <= threshold]
    stale = _overdue_spools(data["spools"], max_open)
    return {
        "low_stock": low_stock,
        "stale": [{"spool": spool, "days_open": days_open} for spool, days_open in stale],
    }


def yearly_stats(year: int) -> Dict:
    data = load_data()
    monthly_consumption = {m: 0.0 for m in range(1, 13)}
    monthly_spend = {m: 0.0 for m in range(1, 13)}

    for log in data["print_logs"]:
        try:
            date = dt.date.fromisoformat(log["date"])
        except ValueError:
            continue
        if date.year == year:
            monthly_consumption[date.month] += float(log.get("used_weight", 0))

    for purchase in data["purchases"]:
        try:
            date = dt.date.fromisoformat(purchase["date"])
        except ValueError:
            continue
        if date.year == year:
            monthly_spend[date.month] += float(purchase.get("cost", 0))

    return {
        "year": year,
        "consumption_by_month": monthly_consumption,
        "spend_by_month": monthly_spend,
    }


def reset_data(data: Dict) -> None:
    """Overwrite the data store with provided data (test helper)."""
    save_data(data)
