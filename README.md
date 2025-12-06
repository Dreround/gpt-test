# 3D 打印耗材管理工具

离线运行的命令行工具，用于个人记录 3D 打印耗材库存、打印消耗与采购成本。数据默认保存在本地 `data/filament_data.json`（可通过环境变量 `FILAMENT_APP_DB` 定位到自定义路径）。

## 功能
- 录入耗材卷品牌、材质、颜色、入库重量、当前剩余重量与开封日期。
- 记录打印任务的耗材用量，自动扣减对应耗材卷的库存。
- 库存不足提醒与开封时间超限提醒（阈值可配置）。
- 采购记录与年度支出/消耗趋势统计。
- 可自定义重量单位（默认克 g），界面展示同步更新。
- 完全离线运行，无需登录与云同步。

## 安装与运行
无需额外依赖，直接使用 Python 3 运行。

```bash
python -m filament_app.cli --help
```

### 示例
```bash
# 新增耗材卷
python -m filament_app.cli add-spool --brand eSun --material PLA --color Red --initial-weight 1000 --opened-date 2024-01-10

# 查看库存（显示开封日期）
python -m filament_app.cli list-spools --show-opened

# 记录打印消耗
python -m filament_app.cli record-print --spool-id <spool-id> --used-weight 50 --note "测试件" --date 2024-03-01

# 采购记录
python -m filament_app.cli add-purchase --brand eSun --material PLA --color Red --weight 1000 --cost 149 --date 2024-02-01

# 提醒与统计
python -m filament_app.cli reminders
python -m filament_app.cli stats --year 2024

# 配置阈值（例如低于 150g 提醒，开封超过 120 天提醒）
python -m filament_app.cli set-config --low-stock-threshold 150 --max-open-days 120

# 配置重量单位
python -m filament_app.cli set-config --weight-unit g
```

## 备注
- 自动扣减基于用户输入的消耗量，不会与打印机通讯。
- 若希望在测试或不同环境下使用独立数据文件，可设置 `FILAMENT_APP_DB=/path/to/db.json`。
