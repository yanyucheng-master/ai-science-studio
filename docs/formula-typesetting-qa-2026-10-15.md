# 理科公式排版收尾与验收（2026-10-15）

本轮基于已 fetch 的 `origin/master`：`e9fdd498bb78b10ffc06da18818595e65153dcb8`。验收完成时，变更保留在本地，尚未暂存、提交、推送、创建 PR 或部署。本记录用于证明本地实现与验收结果；后续 GitHub 提交及公网发布状态须分别核验。公网分支及鸿蒙工程不在本轮修改范围。

最终状态：本轮实现、静态审核及下表列出的验收均已完成，通过后未再修改产品代码。

## 实现范围

| 文件 | 改动 |
| --- | --- |
| `web/science-formulas.js` | 新增共享显示工具：受控语法树、HTML/SVG 渲染、简单 TeX 规范化、幂等更新、原始数学文本与复制处理。 |
| `web/app.js` | 替换零散分式替换规则；接入场景、步骤、参数、菜单、识别反馈和导师提示；原题不格式化；AI 上下文从显示节点读取原始表达式。 |
| `web/physics-extra.js` | 扩大机械效率图的公式表格、行距和画布底部空间。 |
| `web/ai-tutor.js` | 正文、步骤、关键公式、建议追问及历史回复共用显示工具；KaTeX 保留安全配置，以清晰的数学样式呈现分式；选中引用识别公式源文本。 |
| `web/styles.css` | 角标、分式、根式的公共样式；提高公式卡中分式和手机图示放大提示的字号；数值与单位保持在同一行。 |
| `web/index.html` | 加载本地公式模块，更新本轮修改资源的缓存版本。 |
| `web/announcements.json` | 新增 `20261015-science-formula-typesetting`，revision 1；既有公告保持原样。 |
| `server/test/science-formulas.test.js` | 54 项公式、单位、语义边界和结构深度回归。 |
| `server/scripts/verify-formula-browser.js` | 五尺寸真实 Edge 验收；检查 HTML/SVG 几何、复制、可访问来源、注入、AI 上下文和历史恢复。 |
| `verify-animation-browser.js`、`verify-announcements-browser.js`、`verify-question-bank-browser.js`、`verify-tutor-browser.js`、`verify-week1-browser.js` | 加载新本地模块；题库断言从可复制原文读取上下结构公式；支持独立输出目录；动画检查区分持续场景回调与已有的引用选择一次性回调。 |

原有计算模型、题目识别和精度规则保持原样。未修改 `server/src`、AI 接口路由、请求流程、数据库、部署配置、远程依赖或 CDN。`buildMasterLabAIContext` 的变化仅恢复 DOM 格式化前的数学源文字，防止 `W有/W总` 变成 `W有W总`、`v₀²` 按视觉节点顺序变成 `v20`。

## 排版规则与典型修复

- 数学除法使用水平分数线和上下结构，保留分组；`1/2gt²` 的分母只有 2，`mv₀/k(1−e^{-kt/m})` 的括号仍在分式外。支持根式内嵌分式、函数分式和化学物质的量分式。
- 中文、数字与字母角标使用实际角标布局，共享渲染器生成的 HTML/SVG 角标为基字的 65%；同时有上下标时分别占据右上和右下位置。`W有`、`R并`、`F浮`、`Q吸`、`ρ液` 等不再同高排列。
- 根号横线覆盖全部被开方内容；根号符号随被开方内容高度伸展。SVG 使用原生 `tspan` 与 `path`，不向 SVG 插入 HTML `sub`。
- `m/s²`、`kg/m³`、`J/(kg·℃)` 等标准单位保留斜杠；网址、代码片段、普通中文分类斜杠、遗传语境中的 `B/b` 和占位下划线保留其原意。数值与单位不拆成两行。
- `=` 和 `≈`、计算值与有效数字沿用模型原输出；不由显示工具重新计算或决定近似。
- 每个结构化公式保存 `data-math-source`；复制与 AI 上下文读取源表达式，保留分式和角标语义，复制多段内容保留换行。
- AI 使用仓库内 KaTeX 和 mhchem；保留 `trust: false`、展开次数和尺寸上限。普通文本只创建受控 DOM；本地模板 HTML 经标签和属性允许清单处理。

## 验收范围与证据

测试使用 Edge 155.0.4283.45 的隔离配置，不读取用户浏览器密钥。AI 回归使用本地响应夹具或已保存的真实回答回放，不代表本轮调用了线上模型。异常服务用例中的预期 503 与正常流程错误分开记录。

产物目录：`artifacts/formula-closeout-2026-10-14/`。任务跨日，因此保留原目录日期。下表所列 JSON 和日志为验收依据；`browser-quick.json` 等修复期间的中间记录不代表最终结果。

| 检查 | 范围 | 证据 |
| --- | --- | --- |
| 单元测试 | 218 项，其中 54 项为新增公式回归 | `unit-tests.log` |
| 原题与数值回归 | 214 道题；114 道本地模板、100 道交给 AI 的题意边界；保留精确值、约等号和有效数字断言 | `question-bank.log` |
| 全站公式布局 | 69 组：49 组物理、10 组数学、5 组化学、5 组生物；另含五尺寸 AI 与历史恢复 | `browser-report.json` |
| 物理分支补测 | 20 组：五种尺寸的摩擦制动、线性阻力分式指数、求电阻及求电压 | `browser-variants.json` |
| AI 最终显示与上下文 | 390、768、1024、1366、1920 宽度；含中文下标、嵌套分式、伸缩括号、aligned 环境与原始公式请求断言 | `browser-report.json`、`browser-ai-final.json` |
| 第一周兼容回归 | 50 组布局、2 组收藏流程、3 组动画检查 | `week1/browser-report.json` |
| 动画 | 两种桌面尺寸的普通/演示模式、减少动态效果、手机操作、参数拖动、真实后台停止和恢复、4 倍 CPU 降速 | `animation/report.json` |
| AI 回答质量与安全 | 17 组，含化学、生物遗传、HTML 注入、无效数学、长历史和请求期间切换条件 | `ai-quality/report.json` |
| 流式与请求行为 | 9 组，含完整输出、缺少尾帧、重试恢复、提示、超时、停止和无密钥本地提示 | `tutor-sse/report.json` |
| 科学数值基线 | 12 个扩展物理模板的默认/最小/最大参数、5 类数学函数及刹车/木板/平抛/电路/化学，共 61 组配置 | `numeric-before.json`、`numeric-after.json` |
| 静态范围 | 语法、差异空白、公告格式/历史、资源版本、无新远程依赖、源码修改范围 | `source-audit.json`、`source-manifest.json` |

实际屏幕尺寸为 **390×844、768×1024、1024×768、1366×768、1920×1080**。物理必测平抛、木板滑块、串联/并联电路、机械效率、浮力、热平衡、凸透镜；1366 宽度额外遍历全部 17 个物理预设。数学覆盖平方根、对数、指数、正弦、余弦及多项式切线。生物本地细胞识别没有计算公式，数值表达由遗传回答回放补充验证。

几何断言覆盖：分数线与分子分母居中、中文下标字号、上下标基线、根号横线和高度、公式溢出、页面横向溢出、SVG 文字边界与相互重叠、动态移动/隐藏后线条同步、原题无公式节点、重复格式化、实际 copy 事件、段落换行及数值/单位不拆行。另人工检查了各尺寸的代表截图。

手机复杂教材图保留全图概览与“放大图示”。机械效率放大后可左右滑动，公式表格基字实测约 14.1 px；角标按比例缩小。概览并不承诺所有图内文字均为正文大小。

最终动画采样中，平抛、化学、生物及串联电路的回调 P95 为 0.2–0.3 ms；螺线管在 4 倍 CPU 降速下为 3.0 ms。实测时钟最多保留一个持续回调，切到后台停止，恢复后继续；这些是本机采样结果，不是对所有设备帧率的保证。

数值文件比较对 JSON 中的非有限值采用相同序列化方式，线性阻力模型原本的无限渐近停止时间因此记为 null；同时审核计算函数的源码差异，避免把序列化相同误当作计算相同。

## 特殊表达式与边界

已检查模板与回放用例没有遗留的未修复公式。仍保留的斜杠属于标准单位、分类/结果分隔、坐标轴单位或进度“1/4”。

显示工具不是完整的符号计算器：规范的 TeX 环境和 mhchem 交给本地 KaTeX；自定义宏、着色等扩展命令不重写内部语法。超出长度或结构深度上限的异常输入保留源文本，避免递归失控；无效 TeX 沿用既有错误提示。这些处理不会更改题目或计算结果。

## 复现

先设置 `PLAYWRIGHT_MODULE` 指向已安装的 Playwright。默认浏览器为 Edge，可用 `BROWSER_CHANNEL` 指定本机其他已安装 Chromium 通道。

```powershell
cd server
npm.cmd test
cd ..
node server/scripts/verify-question-bank-browser.js
node server/scripts/verify-formula-browser.js
node server/scripts/verify-formula-browser.js --ai-only
node server/scripts/verify-formula-browser.js --variants
node server/scripts/verify-week1-browser.js
node server/scripts/verify-animation-browser.js
node server/scripts/verify-ai-quality-browser.js
node server/scripts/verify-tutor-browser.js
```

`WEEK1_QA_OUTPUT`、`ANIMATION_QA_OUTPUT`、`AI_QUALITY_OUTPUT`、`TUTOR_QA_OUTPUT` 可将现有测试结果写入独立目录。验收阶段未触发发布，因此未暂存文件，也未用空的暂存区冒充公告发布门禁。后续经授权发布时，须按 `docs/announcements.md` 与 `docs/render-publish.md` 执行完整提交/推送检查。
