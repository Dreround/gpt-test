import argparse
import datetime as dt
from textwrap import dedent
from typing import Any, Dict

from . import services


def _print_table(title: str, rows: list[list[Any]], headers: list[str]) -> None:
    print(f"\n{title}")
    print("-" * len(title))
    print("\t".join(headers))
    for row in rows:
        print("\t".join(str(item) for item in row))


def _format_monthly(data: Dict[int, float]) -> str:
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return " | ".join(f"{months[m-1]}: {data[m]:.2f}" for m in range(1, 13))


class FilamentCLI:
    def __init__(self) -> None:
        self.parser = argparse.ArgumentParser(
            description="3D打印耗材管理 - 离线本地工具",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog=dedent(
                """
                示例:
                  python -m filament_app.cli add-spool --brand eSun --material PLA --color Red --initial-weight 1000 --opened-date 2024-01-10
                  python -m filament_app.cli record-print --spool-id <id> --used-weight 40 --note "测试打印"
                  python -m filament_app.cli stats --year 2024
                """
            ),
        )
        subparsers = self.parser.add_subparsers(dest="command")

        add_spool = subparsers.add_parser("add-spool", help="新增耗材卷")
        add_spool.add_argument("--brand", required=True)
        add_spool.add_argument("--material", required=True)
        add_spool.add_argument("--color", required=True)
        add_spool.add_argument("--initial-weight", required=True, type=float)
        add_spool.add_argument("--remaining-weight", type=float)
        add_spool.add_argument("--opened-date")

        list_cmd = subparsers.add_parser("list-spools", help="查看库存")
        list_cmd.add_argument("--show-opened", action="store_true", help="显示开封日期")

        record = subparsers.add_parser("record-print", help="记录打印耗材消耗")
        record.add_argument("--spool-id", required=True)
        record.add_argument("--used-weight", required=True, type=float)
        record.add_argument("--note")
        record.add_argument("--date", help="YYYY-MM-DD，缺省为今天")

        purchase = subparsers.add_parser("add-purchase", help="记录耗材采购")
        purchase.add_argument("--brand", required=True)
        purchase.add_argument("--material", required=True)
        purchase.add_argument("--color", required=True)
        purchase.add_argument("--weight", required=True, type=float)
        purchase.add_argument("--cost", required=True, type=float)
        purchase.add_argument("--date", help="YYYY-MM-DD，缺省为今天")

        subparsers.add_parser("reminders", help="查看低库存/过期提醒")

        stats = subparsers.add_parser("stats", help="年度成本与消耗趋势")
        stats.add_argument("--year", type=int, default=dt.date.today().year)

        config = subparsers.add_parser("set-config", help="配置提醒阈值")
        config.add_argument("--low-stock-threshold", type=float)
        config.add_argument("--max-open-days", type=int)
        config.add_argument("--weight-unit")

    def run(self, args: list[str] | None = None) -> None:
        options = self.parser.parse_args(args=args)
        command = options.command

        if command == "add-spool":
            spool = services.add_spool(
                brand=options.brand,
                material=options.material,
                color=options.color,
                initial_weight=options.initial_weight,
                remaining_weight=options.remaining_weight,
                opened_date=options.opened_date,
            )
            print("新增耗材卷:", spool)
        elif command == "list-spools":
            spools = services.list_spools()
            config = services.get_config()
            unit = config.get("weight_unit", "g")
            headers = ["ID", "品牌", "材质", "颜色", f"剩余/入库重量({unit})", "开封日期"] if options.show_opened else ["ID", "品牌", "材质", "颜色", f"剩余重量({unit})"]
            rows = []
            for spool in spools:
                if options.show_opened:
                    rows.append(
                        [
                            spool["id"],
                            spool["brand"],
                            spool["material"],
                            spool["color"],
                            f"{spool['remaining_weight']:.1f}/{spool['initial_weight']:.1f}",
                            spool.get("opened_date") or "-",
                        ]
                    )
                else:
                    rows.append(
                        [
                            spool["id"],
                            spool["brand"],
                            spool["material"],
                            spool["color"],
                            f"{spool['remaining_weight']:.1f}",
                        ]
                    )
            _print_table("当前库存", rows, headers)
        elif command == "record-print":
            log = services.record_print(options.spool_id, options.used_weight, options.note, options.date)
            print("已记录打印消耗:", log)
        elif command == "add-purchase":
            purchase = services.add_purchase(
                brand=options.brand,
                material=options.material,
                color=options.color,
                weight=options.weight,
                cost=options.cost,
                date=options.date,
            )
            print("采购记录已添加:", purchase)
        elif command == "reminders":
            reminders = services.reminders()
            config = services.get_config()
            unit = config.get("weight_unit", "g")
            low_stock_rows = [
                [spool["id"], spool["brand"], spool["color"], f"{spool['remaining_weight']:.1f} {unit}"]
                for spool in reminders["low_stock"]
            ]
            stale_rows = [
                [item["spool"]["id"], item["spool"]["brand"], item["spool"].get("opened_date"), item["days_open"]]
                for item in reminders["stale"]
            ]
            _print_table("低库存提醒", low_stock_rows, ["ID", "品牌", "颜色", f"剩余({unit})"])
            _print_table("开封超期提醒", stale_rows, ["ID", "品牌", "开封日期", "已开封天数"])
        elif command == "stats":
            result = services.yearly_stats(options.year)
            config = services.get_config()
            unit = config.get("weight_unit", "g")
            print(f"年度统计: {options.year}")
            print(f"消耗趋势({unit}):", _format_monthly(result["consumption_by_month"]))
            print("支出趋势:", _format_monthly(result["spend_by_month"]))
        elif command == "set-config":
            config = services.set_config(
                low_stock_threshold=options.low_stock_threshold,
                max_open_days=options.max_open_days,
                weight_unit=options.weight_unit,
            )
            print("已更新配置:", config)
        else:
            self.parser.print_help()


def main() -> None:
    FilamentCLI().run()


if __name__ == "__main__":
    main()
