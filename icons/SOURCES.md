# 天气图标来源

本目录的彩色天气 PNG 来自 [Breezy Weather](https://github.com/breezy-weather/breezy-weather) 项目，
取自其 `app/src/main/res/drawable/` 目录，按原文件名复制，仅用于本桌面扩展的天气卡片。
上游许可证为 GNU Lesser General Public License v3.0（LGPL-3.0），与 GPL-3.0 兼容；此处保留来源与归属说明。

- 上游仓库：https://github.com/breezy-weather/breezy-weather
- 固定提交：`7619882ee977e9269560da475eb321f747bcdd86`（`main` 分支，2026-11-20 取用）
- 下载方式：`https://api.github.com/repos/breezy-weather/breezy-weather/contents/app/src/main/res/drawable/<文件名>.png?ref=7619882ee977e9269560da475eb321f747bcdd86`，取响应 `content` 字段的 base64 解码。

| 文件 | 上游文件 | 用途 |
| --- | --- | --- |
| `weather_clear_day.png` | `weather_clear_day.png` | 晴（白天） |
| `weather_clear_night.png` | `weather_clear_night.png` | 晴（夜间） |
| `weather_partly_cloudy_day.png` | `weather_partly_cloudy_day.png` | 多云（白天） |
| `weather_partly_cloudy_night.png` | `weather_partly_cloudy_night.png` | 多云（夜间） |
| `weather_cloudy.png` | `weather_cloudy.png` | 阴 / 未知分类回退 |
| `weather_fog.png` | `weather_fog.png` | 雾 |
| `weather_rain.png` | `weather_rain.png` | 雨 |
| `weather_snow.png` | `weather_snow.png` | 雪 |
| `weather_thunderstorm.png` | `weather_thunderstorm.png` | 雷暴 |
| `weather_hail.png` | `weather_hail.png` | 冰雹（预留） |
| `weather_haze.png` | `weather_haze.png` | 霾（预留） |

图标原始尺寸 256×256，运行时由 `St.TextureCache` 缩放到 56×56 显示。
