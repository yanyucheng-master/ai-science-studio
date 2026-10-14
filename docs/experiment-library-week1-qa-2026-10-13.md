# 第一周实验库扩展验收（2026-10-13 至 2026-10-14）

范围：主文件夹网页版，两个物理模板、推荐与收藏语义、通用模板学段数据；不包含第二周的学段切换或跨学科框架。主分支基线为 `27be2672a44fab174d5276d0e75347a60d8f0d8d`。

## 结果与边界

- 并联电路：两个定值电阻，电源电压已知；计算 I₁、I₂、I、R并。支持阻值相等、R₁/R₂ 在题干中反序、kΩ/mV 换算、小数以及零电压。例如 R₁=6Ω、R₂=3Ω、U=6V 得到 1A、2A、3A、2Ω。
- 平面镜：正立等大虚像，v=u，物像距离 d=2u，h′=h。只给出物距时不虚构物高，只给出物高时不虚构像距；未知维度用“示意”与“格”标识，不进入答案或 AI 的确定性结果。
- 混联、三电阻、滑变、灯泡、非理想电表、依赖题图、运动/转镜、多镜、最小镜长、缺少求解条件、未求值的算式和不等式均拒绝本地套用。
- 并联演示范围：R₁/R₂ 为 0.1–1000Ω；电压为 0V 或 0.01–1000V。平面镜物距为 0.1–1000cm，物高为 0.1–300cm。超出范围交给 AI。换算为 Ω、V、cm 后的已知输入最多四位小数；更高精度拒绝本地匹配，不舍入题干。
- 显示精确值或标记近似值；演示模型采用理想电源/导线/电流表。流动光点只表示电流方向，不代表实际漂移速度；物像位置和高度分别缩放。

## 教材与科学性核对（2026-10-14）

中文教材的学段和章节依据出版社官方书目定位；公式与成像性质另外核对可访问的权威教材正文。未复制教材插图或题目，图示由本项目独立绘制。

| 来源 | 本轮实际核验范围 |
|---|---|
| 人民教育出版社：[《义务教育教科书·物理·八年级上册》](https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250823.shtml)，ISBN 9787107245008 | 官方目录第四章第 3 节为“平面镜成像”。该网页是书目，并非教材全文。 |
| 人民教育出版社：[《义务教育教科书 物理 九年级全一册》](https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250693.shtml)，ISBN 9787107262173 | 官方目录第十五章第 5 节电流规律、第十六章第 2 节电压规律、第十七章欧姆定律及串并联应用。 |
| OpenStax / Rice University：[College Physics 2e，21.1 Resistors in Series and Parallel](https://openstax.org/books/college-physics-2e/pages/21-1-resistors-in-series-and-parallel)，“Resistors in Parallel”及式 21.17–21.20 | 支路同压、总电流为支路之和、欧姆定律和并联等效电阻；导线电阻忽略。支路独立以电源电压保持不变为前提。 |
| OpenStax / Rice University：[University Physics Volume 3，2.1 Images Formed by Plane Mirrors](https://openstax.org/books/university-physics-volume-3/pages/2-1-images-formed-by-plane-mirrors)，图 2.2 及其正文 | 正立、等大、物像等距、虚像不能直接投影到光屏；镜面对称关系。 |

本项目中 u、v 为到镜面的距离大小，不采用带正负号的几何光学像距约定。物像距离 d = u + v = 2u；两个电阻的 R并 = R₁R₂/(R₁ + R₂) 是上述定律的代数推导。零电压时总电阻仍由阻值计算，不使用 0/0。镜面后方虚像与横向对称辅助线均用虚线；横向辅助线不冒充真实光线。

已找到国家智慧教育平台的[八上电子课本](https://r3-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/e5618f17-c06e-4c4c-944e-0ee8ced25391.pkg/pdf.pdf)与[九年级电子课本](https://r3-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/ed5f6a59-0cc5-47e9-adc3-0033711700ea.pkg/pdf.pdf)，以及[上海市教委转载的 2022 年课标发布及附件](https://edu.sh.gov.cn/mbjy_fgwx_qt/20220720/02b90de93ebd49099e43063f7a6e2630.html)。本轮 PDF 全文请求受访问限制或超时，未据搜索摘要宣称读过全文，也未编造国内教材页码；本文不声称已逐页审阅最新人教版教材。

## 已执行验证

| 项目 | 结果 | 证据 |
|---|---|---|
| `npm test` | 164 / 164 通过 | `artifacts/week1-2026-10-13/npm-test.log` |
| `npm run test:questions` | 214 / 214 通过：本地 114，转 AI 100 | `artifacts/week1-2026-10-13/question-bank.log` |
| 新模板最终单元复查 | 43 / 43 通过，含额外的平移表述 | `artifacts/week1-2026-10-13/week1-unit-final.log` |
| `npm run test:week1` | 50 组布局检查、2 组收藏流程、3 组动画结果全部通过，失败 0 | `artifacts/week1-2026-10-13/browser-report.json` |
| 公网 worktree 复核 | 新模板 43 / 43，JavaScript 语法与差异检查通过；共享实现一致 | `artifacts/week1-2026-10-13/public-sync-report.json` |
| 两分支公告静态检查 | 各检查本轮明确清单 12 个文件，通过；真实暂存区哈希保持不变 | `artifacts/week1-2026-10-13/release-static-report.json` |
| 公网发布审核补充验证 | 19 / 19 通过：提示过滤、直连/网关路由与共同核对规则，使用模拟响应 | `artifacts/week1-2026-10-13/public-hint-release.log` |

浏览器检查采用本机 Edge 155.0.4283.45 的隔离测试会话，宽度包括 320、390、768、1366、1920px。验证预设菜单、真实生成、参数滑动与鼠标拖动、SVG 节点保留、文字边界/重叠、页面横向溢出、读数卡完整性、放大与平移、物像对称、参数极值及四位小数输入保真。图中不再放解释脚注；实测上述布局的 SVG 标注最小实际字号约 16.15px，读数区说明及标签至少 16px、数值 18px，解析正文 15px。参数区移除解释小字，标签、数值和单位至少 16px；名称、数值控制与滑条分行，避免相互挤压。截图保存在上述本地证据目录；人工检查过桌面和手机默认画面。

动画使用已有的统一 requestAnimationFrame 时钟。稳定窗口中待处理的动画帧最多 1 个；实测回调耗时 P95 约 0.6ms，1200ms 窗口 219 帧，最大帧间隔约 5.8ms。此为当前 Windows/Edge 环境的一次测量，不代表所有真机帧率。光点按每帧位移累积，测试确认修改电阻的同一输入事件中位置不跳变。零电压、进入 AI 问答页和系统减少动态效果时停止光点；平面镜空闲时不维持无用的动画循环。

收藏检查覆盖新访客、打开推荐不点亮星标/不写存储、首次收藏、刷新恢复、取消最后一条后的空状态、旧默认条目兼容、损坏的存储内容，以及存储被浏览器禁止时的当前页面操作。

所有浏览器请求限制在本地测试站点；不读取 `.env` 或浏览器个人配置，不发送真实 AI 请求。最初 `npm test` 受到沙盒对本地回环连接的限制，获准在本地测试环境运行后通过；初版浏览器检查发现并修复了场景高度覆盖、顶部容器拦截放大按钮、手机图示文字过小的问题。

## 分支同步与发布状态

公网 worktree：`artifacts/ai-fix-2026-10-08/public-worktree`，分支 `codex/public-demo-byo-key`，本轮同步前 HEAD 为 `7817846088e611767a345783f0b697f8283c8310`。该工作区原有上一轮 AI 导师的未提交修改，本轮按增量补丁同步，不整页覆盖，不改变公网 AI 脚本引用与配置。

同步前的文件备份、哈希清单与增量补丁保存在 `artifacts/week1-2026-10-13/public-before/`、`public-before.json` 和 `week1-public.patch`。第一次增量同步记入 `public-sync-report.json`：共享实现按 CRLF/LF 归一化后逐文件一致，当时 8 个既有 AI 文件原始 SHA-256 不变。最初字节校验发现的是 Git 换行格式差异，未以整页覆盖方式处理。

用户随后授权审核完整发布范围。审核发现公网草稿尚未包含主分支最后一版提示过滤：常见数字及与已知量重复的结果、分数、根式仍可能泄露，提醒字段也未过滤。现已只同步对应过滤代码和两组回归测试，并将 README 的验证边界说明同步到主分支版本；19 项针对性检查通过。公网 AI 服务地址、个人密钥优先、Flash max 配置及错误处理保留。发布备份与变更哈希见 `publication-before/`、`public-publication-fixes.json`，AI 脚本引用更新为 `20261014-week1-public-1`。上一轮尚未发布的 AI 公告按主分支实际内容校正，不再把服务端源码更新写成公益后台已经重新部署。

公告 ID：`20261014-experiment-library-week1`，revision 1。最初两分支的 `node server/scripts/check-announcement-release.js --base HEAD --staged` 使用临时 Git 索引检查本周 12 个文件，通过且未改变真实暂存区。最终发布将使用主分支 12 个、公网分支 20 个文件的明确清单，分别检查实际暂存内容，并在推送前对已获取的目标远端引用执行 `--committed` 检查。公网批次还包含上一轮未提交的 AI 导师更新及上述漏同步修复，已在公告中区分。

本轮审核清单共 12 个文件：`web/app.js`、`web/physics-extra.js`、`web/styles.css`、`web/index.html`、`web/announcements.json`、`server/package.json`、`server/eval/local-template-bank.json`、`server/scripts/verify-question-bank-browser.js`、`server/scripts/verify-week1-browser.js`、`server/test/week1-templates.test.js`、本验收文档与 `docs/experiment-library-plan-2026-10-12.md`。本地证据、备份、临时脚本及原有设计候选未加入清单。

公网清单在上述 12 个文件之外，增加 `server/README.md`、`server/scripts/verify-tutor-browser.js`、`server/src/protocol.js`、`server/test/protocol.test.js`、`server/test/web-ai-tutor.test.js`、`server/test/web-tutor-checks.test.js`、`web/ai-tutor.js`、`web/tutor-checks.js`，共 20 个文件；这些是已有 AI 更新及所需依赖，已纳入完整发布审核。

发布分工于 2026-10-14 经用户明确改为由 Codex 审核、提交、推送与核验。此记录保存时仍在提交前核查阶段，GitHub、CI 与 Render 的实际结果待发布完成后补记。代码同步到本地公网分支不等于网站已更新。

复跑：在 `server/` 运行上述 npm 命令。浏览器脚本沿用 `PLAYWRIGHT_MODULE` 与 `BROWSER_CHANNEL` 环境变量，默认 Edge；测试依赖未写入应用生产依赖。
