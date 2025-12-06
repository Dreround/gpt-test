import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from filament_app import services
from filament_app.storage import DEFAULT_DATA, save_data


class ServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_db = tempfile.NamedTemporaryFile(delete=False)
        self.addCleanup(self._cleanup_tempfile)
        os.environ["FILAMENT_APP_DB"] = self.temp_db.name
        save_data(DEFAULT_DATA)

    def _cleanup_tempfile(self) -> None:
        try:
            os.remove(self.temp_db.name)
        except FileNotFoundError:
            pass

    def test_add_spool_and_record_print_updates_remaining(self):
        spool = services.add_spool(
            brand="TestBrand",
            material="PLA",
            color="Blue",
            initial_weight=1000,
            opened_date="2024-01-01",
        )
        services.record_print(spool["id"], 120)
        updated_spool = next(item for item in services.list_spools() if item["id"] == spool["id"])
        self.assertAlmostEqual(updated_spool["remaining_weight"], 880)

    def test_reminders_return_low_stock_and_stale(self):
        spool = services.add_spool(
            brand="Low",
            material="PLA",
            color="Black",
            initial_weight=500,
            remaining_weight=80,
            opened_date="2023-01-01",
        )
        reminders = services.reminders()
        self.assertIn(spool["id"], {s["id"] for s in reminders["low_stock"]})
        stale_ids = {item["spool"]["id"] for item in reminders["stale"]}
        self.assertIn(spool["id"], stale_ids)

    def test_yearly_stats_accumulates_monthly(self):
        services.add_purchase(
            brand="Buy",
            material="ABS",
            color="White",
            weight=1000,
            cost=200,
            date="2024-02-10",
        )
        spool = services.add_spool(
            brand="Use",
            material="PETG",
            color="Green",
            initial_weight=1000,
        )
        services.record_print(spool["id"], 50, date="2024-01-15")
        stats = services.yearly_stats(2024)
        self.assertEqual(stats["spend_by_month"][2], 200)
        self.assertGreater(stats["consumption_by_month"][1] + stats["consumption_by_month"][2], 0)

    def test_get_config_merges_defaults(self):
        # remove config from stored data to simulate legacy file
        current = services.load_data()
        current.pop("config", None)
        services.save_data(current)
        config = services.get_config()
        self.assertIn("weight_unit", config)
        self.assertEqual(config.get("weight_unit"), DEFAULT_DATA["config"]["weight_unit"])

    def test_set_config_rejects_invalid_thresholds(self):
        with self.assertRaises(ValueError):
            services.set_config(low_stock_threshold=0)
        with self.assertRaises(ValueError):
            services.set_config(max_open_days=0)


if __name__ == "__main__":
    unittest.main()
