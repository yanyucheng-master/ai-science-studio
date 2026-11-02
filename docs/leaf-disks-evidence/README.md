# 高中叶圆片教材实验：精选证据

完整38组执行源码 `0be3a530662ec9835731026eb8d5797e62c5e492`，树 `d1790bf4a82903f06d883367db7bb04dd0aebdb9`；干净基线 `e6f43c5b398fb039c80e2f02382119d3566ae1f5`。完整执行期间不改产品和测试源码。之后仅修正三处光照组标注位置、DOM标记及资源版本，增加实际图线相交断言；不改模型、解析、协议或状态。标注补丁/本页新实验图片源码 `e5105a8c835bbe576d531221c5fa3a9d7996443e`，树 `0f750726b398f04eff34e6ab8a30a551f38edd05`。按影响执行六组及Chromium专项两组均通过；命令和退出码另列。后续精选证据/公告元数据提交与上述源码分开报告，公告按影响在最终head复测。

[教材正文映射与逐文件范围](../leaf-disks-textbook.md) · [完整命令/退出码/计数/失败与交互摘要](execution-summary.json) · [PNG哈希与来源SHA](manifest.json)

完整候选38组：36通过、2失败、0进程超时、0未执行组。干净基线36组：33通过、3失败、0进程超时。组内提前中止及未到达断言另列，不包装成全绿。

| 完整执行组 | 实际命令（server目录） | 退出码 | 实际计数 |
| --- | --- | --- | --- |
| leaf-disks-browser | `node scripts/verify-leaf-disks-browser.js` | 0 | {"checks": 197, "layouts": 17} |
| leaf-disks-model | `node --test test/biology-leaf-disks.test.js` | 0 | {"tests": 45, "pass": 45, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| node | `node --test` | 0 | {"tests": 951, "pass": 951, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| question-bank | `node scripts/verify-question-bank-browser.js` | 0 | {"totalQuestions": 586, "local": 270, "mockRoute": 316} |
| week1 | `node scripts/verify-week1-browser.js` | 0 | {"layouts": 50, "failures": 0} |
| week2 | `node scripts/verify-week2-browser.js` | 0 | {"checks": 144, "failures": 0} |
| tutor | `node scripts/verify-tutor-browser.js` | 0 | {"cases": 9} |
| animation | `node scripts/verify-animation-browser.js` | 0 | {"variants": 6} |
| announcements | `node scripts/verify-announcements-browser.js` | 0 | {"reportedPassLines": 8} |
| formula | `node scripts/verify-formula-browser.js` | 0 | {"layouts": 69, "failures": 0, "ai": 5} |
| ai-quality | `node scripts/verify-ai-quality-browser.js` | 0 | {"cases": 17, "passedCases": 17} |
| share | `node scripts/verify-share-browser.js` | 0 | {"checks": 14, "roundTrips": 270, "adjustedTemplates": 43} |
| instant | `node scripts/verify-instant-browser.js` | 0 | {"reportedPassLines": 13} |
| instant-routing | `node scripts/verify-instant-routing-browser.js` | 0 | {"reportedPassLines": 8} |
| tutor-diagram | `node scripts/verify-tutor-diagram-browser.js` | 0 | {"cases": 19, "passedCases": 19, "failedCases": 0} |
| tutor-presentation | `node scripts/verify-tutor-presentation-browser.js` | 0 | {"cases": 27, "passedCases": 27, "failedCases": 0} |
| incline-guard | `node scripts/verify-incline-diagram-browser.js --guard-only` | 1 | {"cases": 6, "passedCases": 1, "failedCases": 5} |
| incline-core | `node scripts/verify-incline-diagram-browser.js` | 0 | {"cases": 7, "passedCases": 7, "failedCases": 0} |
| incline-render | `node scripts/verify-incline-diagram-browser.js --render` | 0 | {"cases": 11, "passedCases": 11, "failedCases": 0} |
| incline-competition | `node scripts/verify-incline-diagram-browser.js --competition` | 0 | {"cases": 19, "passedCases": 19, "failedCases": 0} |
| incline-data | `node scripts/verify-incline-diagram-browser.js --data` | 0 | {"cases": 32, "passedCases": 32, "failedCases": 0} |
| chemistry-model | `node --test test/chemistry-experiments.test.js` | 0 | {"tests": 20, "pass": 20, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| chemistry-browser | `node scripts/verify-chemistry-browser.js` | 0 | {"checks": 200, "layouts": 6} |
| math-model | `node --test test/math-experiments.test.js` | 0 | {"tests": 25, "pass": 25, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| math-browser | `node scripts/verify-math-experiments-browser.js` | 0 | {"checks": 203, "layouts": 9} |
| experiment-layout | `node scripts/verify-experiment-layout-browser.js` | 0 | {"cases": 46, "passedCases": 46, "failedCases": 0} |
| unit-circle-model | `node --test test/unit-circle.test.js` | 0 | {"tests": 73, "pass": 73, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| unit-circle-browser | `node scripts/verify-unit-circle-browser.js` | 0 | {"checks": 219, "layouts": 15} |
| equilibria-model | `node --test test/chemistry-equilibria.test.js test/chemistry-equilibria-templates.test.js` | 0 | {"tests": 63, "pass": 63, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| equilibria-browser | `node scripts/verify-chemistry-equilibria-browser.js` | 0 | {"checks": 134, "layouts": 14} |
| mendel-model | `node --test test/biology-mendel.test.js` | 0 | {"tests": 17, "pass": 17, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| mendel-browser | `node scripts/verify-mendel-browser.js` | 0 | {"checks": 105, "layouts": 7} |
| acceptance-fixes | `node scripts/verify-acceptance-fixes-browser.js` | 0 | {"checks": 62, "failures": 0} |
| microscope-model | `node --test test/biology-microscope.test.js test/biology-microscope-questions.test.js test/biology-microscope-templates.test.js` | 0 | {"tests": 36, "pass": 36, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| microscope-browser | `node scripts/verify-microscope-browser.js` | 0 | {"checks": 249, "layouts": 21} |
| population-model | `node --test test/biology-population.test.js test/biology-population-logistic.test.js` | 0 | {"tests": 65, "pass": 65, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| population-browser | `node scripts/verify-population-browser.js` | 0 | {"checks": 215, "layouts": 16} |
| population-background | `node scripts/verify-population-background-browser.js` | 1 | {"checks": 1} |

## 标注补丁按影响复测

以下仅属于 `e5105a8c835bbe576d531221c5fa3a9d7996443e`，不能把上述38组源码混称最终补丁head执行。题库通过BANK_FILTER=leafDisks筛出本模板26题；完整586题已在完整执行源验证。

| 组 | 实际命令（server目录） | 退出码 | 实际计数 |
| --- | --- | --- | --- |
| leaf-disks-browser | `node scripts/verify-leaf-disks-browser.js` | 0 | {"checks": 201, "layouts": 17} |
| leaf-disks-model | `node --test test/biology-leaf-disks.test.js` | 0 | {"tests": 45, "pass": 45, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| node | `node --test` | 0 | {"tests": 951, "pass": 951, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| question-bank | `node scripts/verify-question-bank-browser.js` | 0 | {"totalQuestions": 26, "local": 8, "mockRoute": 18} |
| animation | `node scripts/verify-animation-browser.js` | 0 | {"variants": 6} |
| announcements | `node scripts/verify-announcements-browser.js` | 0 | {"reportedPassLines": 8} |

## 数据和模型边界

按人教必修1第105页保留六步操作、0.6 cm直径、30片、3组各10片、5 W LED及米尺；只选择教材允许的菠菜与富CO₂清水路径。没有给出实测数据，因此记录表始终待观察。单片上浮独立解释机理，不属于三组结果，也不表示真实上浮速度；不添加光强—浮片数公式，不凭动画得出实测排名或总产氧量。

孔位几何检查确认孔周在叶片内且不碰所绘大叶脉；三杯几何检查确认同高同水位、每杯10片。截图中的比例、距离和气泡不作测量依据。模型原理、程序状态、动画和待测数据分别说明。

## 基线与原始失败

未改基线的种群后台脚本在S型模式暂停后计数pending RAF=1、期望0处中止，单独重跑同样失败；此前离散模式完成的检查与随后S型未到达的断言分别记录。候选是否同样复现以failureComparison实际结果为准，未把一次计数推断为已定位的永久动画原因。

原始失败签名、组内提前中止和未执行边界见execution-summary.json。等待页分享脚本适配当前UI：断言按钮隐藏，公开复制边界仍拒绝未生成实验，后续原断言保留。干净基线的原脚本与显式修改夹具的补测分别记录，不称未改基线全绿。旧斜面guard保留原请求计数期望，当前core/render/competition/data另行完整执行。

候选分享往返270题、调参43组、实际BFCache通过；基线同一夹具补测262题/41组通过。新实验Edge/Chromium各201项检查，含同文档A→B→A、等值编码AI往返、等待页返回、刷新、实际BFCache、独立浏览器、收藏和非法新题导师边界。

## 可直接查看的精选实页

前三图分别覆盖1366排气、820三组光照和390上浮机理/待测记录；另附390打孔点与同一干净基线显微镜的两张风格对照。像素尺寸为实验卡裁图，视口宽度另列。原始日志、其余截图、教材PDF和原页均留本地。

### syringe-1366.png（视口1366）

![syringe-1366.png](syringe-1366.png)

### lighting-820.png（视口820）

![lighting-820.png](lighting-820.png)

### mechanism-records-390.png（视口390）

![mechanism-records-390.png](mechanism-records-390.png)

### punch-390.png（视口390）

![punch-390.png](punch-390.png)

### reference-microscope-1366.png（视口1366）

![reference-microscope-1366.png](reference-microscope-1366.png)

### reference-microscope-390.png（视口390）

![reference-microscope-390.png](reference-microscope-390.png)
