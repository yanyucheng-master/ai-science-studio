# 三套绘图浏览器回归更新

本轮范围是 `master` 上的测试维护。前端仍只绘制条件明确的单物块粗糙斜面受力图，坐标由本地程序推导；不恢复通用 AI 绘图，不修改运行时绘图、后端或模型配置。

## 失败原因与覆盖对应

在未修改的 `b2e6d00` 基线上重新运行三套脚本：实验入口等待通用几何 SVG 超时；路由脚本的三个降级案例仍期待远程坐标请求及远端拒绘理由；导师脚本仍以绝对值函数图作为成功绘图条件，并期待旧编号图例、旧工具栏位置及可挂起的远程绘图请求。当前产品已收窄绘图并调整阅读界面，这些断言不再代表验收范围。

| 旧检查 | 当前检查与保留的目的 |
| --- | --- |
| 任意几何、函数图在实验入口或导师中成功绘制 | 明确斜面题由本地程序绘制；通用几何与函数请求保留文字；所有案例断言 AI 坐标请求为零 |
| 远端拒绘、无效坐标服务返回 | 本地范围拒绘理由可见；本地引擎异常保留文字并释放面板；网关不可用时保留原题，不继续启动导师请求 |
| 模板优先、个人密钥与网关路由 | 严格模板零请求；AI 映射先于绘图；成功映射恢复刹车模板原题及 20、5 参数；个人路径与网关路径分别覆盖 |
| 远程绘图取消、旧响应覆盖、超时 | 实验入口在真实异步边界取消和替换请求；导师在公开 `createScene` 异步边界注入受控等待，验证停止信号、迟到结果丢弃及超时文字降级 |
| 恶意场景进入 UI | 渲染器拒绝事件属性、非法图元、标注中的标签和外部资源；恢复时篡改已保存场景，确认拒绝图示且保留文字、不执行代码 |
| 原实验、收藏及导师往返 | 验证返回后原题和参数恢复、绘图时禁用收藏、收藏存储不变、学科切换清空图示上下文 |
| 旧编号气泡、坐标刻度及通用图例布局 | 当前直接力标签字号、碰撞、裁切、320px 高度上限，以及 390/768/1366/1920 宽度无页面横向溢出；手机显式放大检查几何实际变大 |
| 通用 SVG 公式、图元、缓存及服务取消 | 原有 `science-formulas.test.js`、`instant-scene.test.js` 和公式浏览器回归继续执行；服务缓存、取消、受限表达式和几何校验保留在相应单元测试，不再假定当前前端使用远程场景缓存 |
| 追问、提示、长公式及阅读空间 | 保留数学追问和截断拦截；斜面追问保持原题及物理学科；提示和明确不画图走文字；通过“更多”操作小窗和历史；阅读区对齐并紧接实际工具栏 |

不再读取 `artifacts/instant-engine-2026-10-18/live-final/*.json`，也不把缺失的历史回包当作可跳过的成功。测试夹具随源码提交，浏览器使用独立上下文、假密钥和被拦截的网络请求。可选外部字体以空响应替代，测试不读取个人密钥或发送真实 AI 请求。

取消和超时注入仅存在于测试页面中：生产引擎同步完成本地推导，测试通过公开异步接口模拟未来或异常延迟，以覆盖协调层的真实停止和超时逻辑。它不代表当前本地绘图需要等待远程服务。

## 复现

要求 Node.js 20 以上、Playwright 和已安装的 Edge；可用 `PLAYWRIGHT_MODULE` 指向已有 Playwright 模块，`BROWSER_CHANNEL` 默认 `msedge`。

在 `server` 目录运行：

```powershell
npm run test:instant:browser
npm run test:instant:routing
npm run test:tutor:diagram
```

三个脚本分别写入 `artifacts/instant-browser`、`artifacts/instant-routing`、`artifacts/tutor-diagram`，报告包含逐项结果和失败堆栈，并保存截图；也可设置 `INSTANT_BROWSER_OUTPUT`（前两套）或 `TUTOR_QA_OUTPUT`（导师）隔离每次输出。任何案例失败都使进程返回非零，不删减失败案例或静默跳过。

## 本轮验收

在 Windows 上使用 Node.js 24.14.1、Edge 155.0.4283.62 完成。三套基线失败已按当前契约修复；最终 15 个适用离线入口（完整单元测试及 14 套浏览器脚本）均返回 0，无失败或跳过的单元测试。

| 入口 | 结果 |
| --- | --- |
| `node --test` | 584/584 |
| `verify-instant-browser.js` | 13/13 |
| `verify-instant-routing-browser.js` | 8/8 |
| `verify-tutor-diagram-browser.js` | 19/19 |
| `verify-incline-diagram-browser.js --data` | 32/32，包含左右斜面、题给数据、总开关、恢复和篡改边界 |
| `verify-tutor-presentation-browser.js` | 27/27，使用源码内模拟夹具，未指定外部真实回复回放 |
| `verify-question-bank-browser.js` | 294/294（157 本地，137 交给 AI 路由；不发送真实 AI 请求） |
| `verify-tutor-browser.js` | 通过，包含停止、超时、重试和无密钥降级 |
| `verify-ai-quality-browser.js` | 通过 |
| `verify-share-browser.js` | 14 项检查、157 道题往返通过，包含额外 27 组调参/学段组合 |
| `verify-formula-browser.js` | 69 项布局、5 项模拟 AI 检查通过，无失败 |
| `verify-week1-browser.js` | 50 项布局、2 条收藏流程、3 项动效通过 |
| `verify-week2-browser.js` | 通过，无失败 |
| `verify-announcements-browser.js` | 8 项通过 |
| `verify-animation-browser.js` | 6 组模式/宽度通过，另覆盖性能、减少动效、移动操作和真实后台/恢复 |

本次还通过新增/修改脚本的语法检查、后端 `npm run check` 与 Git 差异空白检查。提交前和推送前分别执行仓库规定的公告检查。没有运行 `eval`、`eval:hard`、`eval:instant` 或 live 浏览器脚本，也没有同步公网分支或部署。

原始日志、逐项 JSON 报告和截图保存在本地 `artifacts/drawing-regression-2026-10-21/`，最终各入口的日志索引为 `final-results.json`，不纳入提交。该记录表示本地验证；GitHub 远端 SHA、CI 与公网部署需要分别核对。
