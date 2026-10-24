# 勾股两种拼图与单位圆验收记录（2026-10-24）

完整执行源码：`e27287ab7302c5c3c7c3e6b084917b0f303163b7`，Git tree：`4e61907f26a8d19907a5d770d2b5a9c195ad2754`。执行期间产品/测试源码未再改动。本记录及公告中的内部验收条目在后续提交中追加，只改文档和公告元数据，不把后续head冒称为完整回归执行版本；最终head和公告专项复测另在PR记录。

本轮增量基线为`c0450b83a272f67ff75f08cf1b5c502ad124eb24`；fetch核对master仍为`7654ce2a3e6d2e6ae833430b32a11ea62fb60ddb`。沿用PR #7，保留既有数列与UI；不合并、部署或推送master/公网分支。教材正文、版本局限、支持文法与逐文件范围见[实施计划](math-proof-circle-plan.md)。

## 两项独立提交与数学依据

- 勾股：`3a373b83c6b1181d147bdc082eb2feb2d2ae35f5`。独立Git archive快照实际执行模型23/23、页面272项通过，原始记录位于`.handoff/math-v2-puzzle-3a373b8/`。本轮最终版本再次执行如下全量与专项。
- 单位圆：`59f53707aea19d6ab71580d21f4ed0ed31e84504`。模板独立注册；后续`e27287a`只补题库检查器的实际结果字段与公告，功能实现未改。
- 勾股证明：对任意合法正a、b，两拼法共享(a+b)大正方形及同样四片直角三角形。终态Ⅰ剩余四边皆为原斜边c，相邻锐角互余给四个直角；终态Ⅱ两矩形各由两片铺满，留下a、b两个正方形。剩余面积相等得c²=a²+b²，开方只在随后应用；不是以数值相等证明。
- 独立手算：3/4→5和9/16/25；5/12→13和25/144/169；1/1→√2和1/1/2；1.5/2→2.5。几何检查包括边界包含、多边形两两裁剪交集为零、面积总和、中心等边直角；搬移各进度验证四片三边与面积不变。SVG实际变换在三尺寸和全屏再核对。
- 单位圆依据P=(cosθ,sinθ)定义；x²+y²=1给恒等关系，整周旋转给周期性。四轴、±30°、45°等用独立精确值；一般角用20项泰勒级数独立核对，不调用被测Math.sin/cos作预期。临近特殊角与轴上角分开，330°与−30°终边相同而过程和曲线横坐标不同。
- 精确值表覆盖四轴、30°/45°/60°及其象限对应角；其他角明确显示近似，不声称所有可代数表示的角均已符号化。度数以整百分之一度校验；π分数通过整数整除换算，不执行表达式。圈数用有理数显示，曲线横轴为rad。

## 环境与完整命令

环境：Windows_NT 10.0.26200 x64；Node v24.22.1；Edge 156.0.4314.42；独立Chromium 151.0.7922.34。执行开始2026-10-24T04:25:50.642Z，结束2026-10-24T04:44:27.412Z（UTC）。
25组：24通过、1个已在干净基线复现的失败、0超时、0未执行。不宣称全绿。

以下命令均在server目录执行。运行器采用系统变量白名单，没有BANK_FILTER、真实AI密钥或.env加载；独立本地服务器/浏览器配置与模拟响应。退出码为各子进程实际值，不使用外层汇总脚本退出0替代失败。

| 组 | 实际命令 | 退出码 | 结果与实际计数 |
| --- | --- | --- | --- |
| node | `node --test` | 0 | passed；702/702，失败0，跳过0 |
| question-bank | `node scripts/verify-question-bank-browser.js` | 0 | passed；392题：本地192，转导师200 |
| week1 | `node scripts/verify-week1-browser.js` | 0 | passed；脚本通过 |
| week2 | `node scripts/verify-week2-browser.js` | 0 | passed；脚本通过 |
| tutor | `node scripts/verify-tutor-browser.js` | 0 | passed；脚本通过 |
| animation | `node scripts/verify-animation-browser.js` | 0 | passed；脚本通过 |
| announcements | `node scripts/verify-announcements-browser.js` | 0 | passed；脚本通过 |
| formula | `node scripts/verify-formula-browser.js` | 0 | passed；脚本通过 |
| ai-quality | `node scripts/verify-ai-quality-browser.js` | 0 | passed；脚本通过 |
| share | `node scripts/verify-share-browser.js` | 0 | passed；脚本通过 |
| instant | `node scripts/verify-instant-browser.js` | 0 | passed；脚本通过 |
| instant-routing | `node scripts/verify-instant-routing-browser.js` | 0 | passed；脚本通过 |
| tutor-diagram | `node scripts/verify-tutor-diagram-browser.js` | 0 | passed；脚本通过 |
| tutor-presentation | `node scripts/verify-tutor-presentation-browser.js` | 0 | passed；脚本通过 |
| incline-guard | `node scripts/verify-incline-diagram-browser.js --guard-only` | 1 | failed；5个基线失败断言 |
| incline-core | `node scripts/verify-incline-diagram-browser.js` | 0 | passed；脚本通过 |
| incline-render | `node scripts/verify-incline-diagram-browser.js --render` | 0 | passed；脚本通过 |
| incline-competition | `node scripts/verify-incline-diagram-browser.js --competition` | 0 | passed；脚本通过 |
| incline-data | `node scripts/verify-incline-diagram-browser.js --data` | 0 | passed；脚本通过 |
| chemistry-model | `node --test test/chemistry-experiments.test.js` | 0 | passed；20/20，失败0，跳过0 |
| chemistry-browser | `node scripts/verify-chemistry-browser.js` | 0 | passed；脚本通过 |
| math-model | `node --test test/math-experiments.test.js` | 0 | passed；23/23，失败0，跳过0 |
| math-browser | `node scripts/verify-math-experiments-browser.js` | 0 | passed；272项断言 |
| unit-circle-model | `node --test test/unit-circle.test.js` | 0 | passed；64/64，失败0，跳过0 |
| unit-circle-browser | `node scripts/verify-unit-circle-browser.js` | 0 | passed；219项断言 |

## 新增失败修复、基线失败与未执行范围

首次完整题库在59f5370上出现8条新增断言失败：检查器没有提取sin/cos/a²/b²/c²，实际字段为undefined；不是把模型结果判成错误后删掉断言。e27287a补齐实际字段，独立预期与断言均保留。本次重新完整执行25组，首次未完成的探索结果保留于`.handoff/math-v2-final-59f5370/`，不混作最终结果。

旧斜面guard-only在本轮起始c0450b8的干净Git archive快照与当前版本均退出1。失败名称、请求次数及断言签名一致：

- original-1366：预期旧坐标请求1次，实际0次；`0 !== 1`。
- original-820：预期旧坐标请求1次，实际0次；`0 !== 1`。
- original-390：预期旧坐标请求1次，实际0次；`0 !== 1`。
- personal-original：预期旧坐标请求1次，实际0次；`0 !== 1`。
- supported-session-and-tampering：预期旧坐标请求1次，实际0次；`0 !== 1`。

未改动旧guard脚本或斜面模型。其余斜面四入口（含--data）及三套绘图入口结果见表。未执行真实AI/live模型评测、Firefox、Safari和移动真机；这些不计为已完成。
源码提交的GitHub实际查询：Actions 0条、check-runs 0条；公开签名验证verified=false、reason=unsigned。保留原自动CI配置，没有把本地结果或零记录写成CI、密钥扫描或签名通过。

## 布局、交互、浏览器和状态证据

Edge：勾股/数列272项、单位圆219项通过；独立Chromium对应为272、219项，均为同一固定源码。额外由Edge实际生成链接，在Chromium独立配置导入：

- unitCircle：当前首参数-45.5，重置基准-30，实际导入及主动重置通过。
- pythagoras：当前首参数3.25，重置基准3，实际导入及主动重置通过。

两专项覆盖1366/820/390与全屏；用几何和DOM断言检查两终态、细长1:12、移动和复位、正负角/四轴/近轴/整周、根式分数、标签和页面无横向溢出。全屏实际滚动到参数，确认可达而非仅保存上半屏。
闭环包括菜单/学段、原统一播放/暂停/继续/Space、参数与固定半径、主动重置、学科往返、收藏当前比较配置、原题与当前导师结果、非法新题保留原实验且导师不借旧答案、独立分享、AI页往返、等价编码、A→B→A、旧学科等待→A、刷新和真实BFCache。篡改半径、精度、范围、单位模式及额外子问的链接均拒绝。
统一animation专项还实际切换前后台，三个数学模板均后台时间不推进、没有待执行帧，恢复后同一时钟继续，maxPending=1。reduced-motion不启用装饰性常驻循环；用户主动播放或手动进度仍可查看教学过程。
勾股与单位圆的目标参数、原题重置基准分别保存。单位圆初始/调参/重置展示目标态；主动播放从0按原有向角方向旋转，过程中明确当前角与目标题目结果，暂停读数不改目标。数学标签、半径、图像与单位均在上述专项核对。

## 选定截图与原始产物

原始报告、stdout/stderr和Edge截图：`.handoff/math-v2-final-e27287a/`；Chromium完整专项：`.handoff/math-v2-chromium-e27287a/`。基线guard：`.handoff/math-v2-baseline-guard-c0450b8/`。少数旧脚本固定产物留在仓库本地artifacts/；均不提交。

六张精选截图如下，均对应本轮固定源码；原图本地保留，SHA256供核对。

| 实验/宽度 | 本地相对路径 | SHA256 |
| --- | --- | --- |
| pythagoras/1366 | `.handoff/math-v2-final-e27287a/math-browser/pythagoras-1366.png` | `bc9c9a536b95c888dd7648b6693aabe07110ef62cb92ae10d81bfee71ae71c8a` |
| pythagoras/820 | `.handoff/math-v2-final-e27287a/math-browser/pythagoras-820.png` | `39aaf3b00e7a4d98b98d5e46e831d2cfc814ee753f50a7600b5e11b1a14999c7` |
| pythagoras/390 | `.handoff/math-v2-final-e27287a/math-browser/pythagoras-390.png` | `c8ed95c1c583ea3df0d692cdb802a9437c2aa5642bd0f6d3c2af5482735883cb` |
| unit-circle-negative/1366 | `.handoff/math-v2-final-e27287a/unit-circle-browser/unit-circle-negative-1366.png` | `3b314cfc9a535347cd790e1fa7ab490a10b76bf7a656afa1d4f334170b9bfacf` |
| unit-circle-negative/820 | `.handoff/math-v2-final-e27287a/unit-circle-browser/unit-circle-negative-820.png` | `b26d2d9195fc9f87efe8c292426e33e27c2265b07fada4df212d06d06d637661` |
| unit-circle-negative/390 | `.handoff/math-v2-final-e27287a/unit-circle-browser/unit-circle-negative-390.png` | `c314e1bb032e80b78aaa5c25fcc3a193324b5fc6345d5dafdf9989bc5efaff4a` |

原始截图、完整教材与个人配置不提交。本记录是脱敏验收说明；化学v2教材/审查流程与已暂停自动化保持原状。
