# 3D 打印耗材管理工具

一款完全离线运行的命令行小工具，用于个人记录 3D 打印耗材的库存、使用和采购信息。所有数据默认保存在本地 `data/filament_data.json`，也可以通过环境变量 `FILAMENT_APP_DB` 指定自定义路径，方便在不同机器或测试环境间切换。

## 核心功能
- **耗材卷管理**：录入品牌、材质（PLA/ABS/PETG 等）、颜色、入库重量、当前剩余重量与开封日期。
- **打印记录扣减**：为每次打印记录耗材用量，自动扣减对应耗材卷的库存，并支持备注与日期。
- **提醒机制**：低库存提醒与开封时间超限提醒，阈值均可配置。
- **采购与成本统计**：记录耗材采购信息，按年份查看支出与消耗趋势。
- **单位可配置**：可在克（g）等单位间切换，所有列表、提醒和统计输出会同步展示。

## 环境要求
- Python 3（标准库即可，无需额外依赖）。
- 无需登录或网络连接，数据仅存储在本地文件。

## 快速开始
```bash
# 查看帮助
python -m filament_app.cli --help

# 指定自定义数据文件（可选）
export FILAMENT_APP_DB=/path/to/filament.json
```

## 常用操作示例
```bash
# 1) 新增耗材卷（录入开封日期便于老化提醒）
python -m filament_app.cli add-spool \
  --brand eSun --material PLA --color Red \
  --initial-weight 1000 --opened-date 2024-01-10

# 2) 查看库存（可显示开封日期）
python -m filament_app.cli list-spools --show-opened

# 3) 记录打印任务消耗（自动扣减库存）
python -m filament_app.cli record-print --spool-id <spool-id> \
  --used-weight 50 --note "测试件" --date 2024-03-01

# 4) 记录采购信息
python -m filament_app.cli add-purchase --brand eSun --material PLA \
  --color Red --weight 1000 --cost 149 --date 2024-02-01

# 5) 查看提醒与年度统计
python -m filament_app.cli reminders
python -m filament_app.cli stats --year 2024

# 6) 配置阈值与重量单位（例如低于 150g 提醒，开封超过 120 天提醒）
python -m filament_app.cli set-config --low-stock-threshold 150 --max-open-days 120
python -m filament_app.cli set-config --weight-unit g
```

## 数据位置与备份
- 默认数据文件：`data/filament_data.json`；若目录不存在，运行命令时会自动创建。
- 设置 `FILAMENT_APP_DB=/path/to/db.json` 可在不同环境使用独立数据文件，或放在云盘目录方便手动同步与备份。

## 注意事项
- 库存扣减依赖用户输入的打印用量，本工具不会与打印机交互，也不解析 G-code。
- 提醒阈值与单位可根据个人习惯调整；若配置为非正数将被拒绝以避免误用。
- 本项目面向个人场景，未实现多用户权限与云同步；后续可自行扩展二维码扫描或图片管理能力。
