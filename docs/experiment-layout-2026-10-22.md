# 实验播放控制栏统一布局与本地验收（2026-10-22）

共用实验卡片统一采用“标题及题干 → 现有播放控制栏 → 原场景、读数与结果 → 原参数栏”的顺序。可播放的物理与化学实验使用同一个上方控制栏；静态模板继续按原规则隐藏播放栏，生物等模板原有参数显隐保持原状。

## 实现与修复

- 整块移动已有 transport 节点，保留全部控件 ID、原有标记和事件监听器；参数节点保持在原场景后方。
- 控制栏下方保留 12px 间距；普通、演示和全屏使用原有尺寸规则，手机仍采用可伸缩进度条。
- 两项新化学实验在全屏中按内容展开，由实验卡片负责滚动，避免长场景被 flex 收缩后裁切。未修改 HEAD 的复现中，可见高度为 539px，实际内容分别为 789px、813px；修复后的桌面及手机全屏验收通过。
- 更新样式资源版本为 20261022-transport-top-1；仅新增公告 20261022-experiment-transport-top@1，原有公告及三个未提交草稿逐字节保留。
- 业务脚本、科学计算、收藏与分享数据协议保持原有内容；新增共享布局浏览器验收入口。

## 验收来源

源码基线：`641739cb309f3d8afbc89859ae76c3b77f89a7c1`，叠加本轮首页、样式、公告及新增布局验收脚本。测试在独立快照中运行，未覆盖原工作区的既有报告。

快照 web/server 文件清单的 SHA-256：`a657ac6f13126b85d8a386d13269d7f7adb95670ed442ce3fa95cc0572d764a0`。测试期间快照源码未发生变化。

时间：2026-10-22T08:26:38.850Z 至 2026-10-22T08:46:18.724Z（UTC）。环境：Node v24.14.1；Edge 155.0.4283.62；Chrome 155.0.8059.85。两个浏览器均为 Chromium，属于不同浏览器的复核。

## 结果

原有 21 个离线入口加 Chrome 化学复核及新增共享布局验收，共 23 个入口：22 个通过，1 个与未修改 HEAD 一致的历史失败，无本次新增失败。

- 完整 Node 测试：615/615；化学单元专项 20/20。
- 题库：366 题，179 题本地处理、187 题转交 AI 路由检查；全部通过，使用模拟响应。
- Edge 化学专项 200 项、Chrome 化学专项 200 项通过；页面与控制台错误均为 0。
- 共享布局验收 46/46：6 类可播放实验 × 4 种视口共 24 组，19 项静态模板，2 组演示模式，1 组学科往返/收藏/分享恢复。可播放组逐一检查播放、暂停、继续、进度、倍速、重置及全屏进出。
- 四种视口为 1366×768、820×900、390×844、1265×638；检查完整控制栏位于首屏、参数留在下方、无横向溢出或控件裁切、控件只有一套。
- 全程使用隔离浏览器、本地页面和模拟 API；未加载个人浏览器资料或真实 AI 密钥，真实 AI 请求为 0。

| 实际命令（server 目录） | 结果 | 退出码 | 秒 |
| --- | --- | --- | --- |
| `node --test`  | 通过 | 0 | 1.3 |
| `node scripts/verify-question-bank-browser.js`  | 通过 | 0 | 247.3 |
| `node scripts/verify-week1-browser.js`  | 通过 | 0 | 75.5 |
| `node scripts/verify-week2-browser.js`  | 通过 | 0 | 39.4 |
| `node scripts/verify-tutor-browser.js`  | 通过 | 0 | 8.9 |
| `node scripts/verify-animation-browser.js`  | 通过 | 0 | 117.9 |
| `node scripts/verify-announcements-browser.js`  | 通过 | 0 | 4.4 |
| `node scripts/verify-formula-browser.js`  | 通过 | 0 | 256.3 |
| `node scripts/verify-ai-quality-browser.js`  | 通过 | 0 | 23.5 |
| `node scripts/verify-share-browser.js`  | 通过 | 0 | 20.5 |
| `node scripts/verify-instant-browser.js`  | 通过 | 0 | 14.6 |
| `node scripts/verify-instant-routing-browser.js`  | 通过 | 0 | 7.9 |
| `node scripts/verify-tutor-diagram-browser.js`  | 通过 | 0 | 11.7 |
| `node scripts/verify-tutor-presentation-browser.js`  | 通过 | 0 | 17.1 |
| `node scripts/verify-incline-diagram-browser.js --guard-only`  | 失败；与 HEAD 基线一致 | 1 | 4.2 |
| `node scripts/verify-incline-diagram-browser.js`  | 通过 | 0 | 5.3 |
| `node scripts/verify-incline-diagram-browser.js --render`  | 通过 | 0 | 8.0 |
| `node scripts/verify-incline-diagram-browser.js --competition`  | 通过 | 0 | 12.3 |
| `node scripts/verify-incline-diagram-browser.js --data`  | 通过 | 0 | 19.0 |
| `node --test test/chemistry-experiments.test.js`  | 通过 | 0 | 0.2 |
| `node scripts/verify-chemistry-browser.js`  | 通过 | 0 | 92.0 |
| `node scripts/verify-chemistry-browser.js` （Chrome） | 通过 | 0 | 92.7 |
| `node scripts/verify-experiment-layout-browser.js`  | 通过 | 0 | 96.0 |

## 历史失败及首轮修正记录

`verify-incline-diagram-browser.js --guard-only` 有 5 个旧断言要求 AI 坐标请求为 1，当前本地斜面路径实际为 0。原始 HEAD 和修复快照的失败用例、实际请求数及断言消息完全一致。该入口仍保留失败结果，未删除或放宽断言。

本轮首批布局检查还发现全屏长化学场景裁切，已在未修改 HEAD 上复现并修复。新验收脚本最初选到手机上隐藏的桌面学段按钮，随后改为定位实际可见按钮；纠正后的完整矩阵全部重新执行通过。初轮未完成的部分结果不计入最终验收。

## 本地交付记录

详细附件保存在 `artifacts/transport-layout-2026-10-22/`：

- `source-manifest.json`：基线、叠加文件及测试源码哈希。
- `full-results.json`、`acceptance-summary.json`：完整入口与结果汇总。
- `runs/`：每组原始 stdout、stderr 和浏览器报告。
- `historical-failure-comparison.json`、`baseline-fullscreen/`：基线对照。
- `review-screenshots/`：桌面化学、桌面物理、手机氯化钠和手机全屏的实际截图。
- `static-checks.json`、`announcement-check.log`：静态与公告核查；公告检查使用临时索引，只纳入本轮新增公告，保留主索引及原草稿。

本轮为本地修复和验收，未创建提交、未推送 GitHub、未更新 CI 或公网部署。
