# 数学整合验收证据（2026-10-26）

完整执行源码 `00f00d8f64e9aac94bf223022ec96e3f2f63d920`；Git tree `e4dae9042d9471b39c5606f7d7976301e860ac26`。已整合当前master `c4b1cced3f099ad59bdae3dff9881c52316837b4`。本目录只含精选页面图和脱敏执行摘要；教材全文/页图、原始日志及个人配置不提交。

[数列人教版正文映射](../math-arithmetic-textbook.md) · [逐组命令/退出码/计数/交互与布局摘要](execution-summary.json) · [PNG哈希与尺寸](manifest.json)

原固定源码完整执行26组：21通过、5失败、0进程超时、0未执行组。原公式/AI入口存在内部定位超时与后续未执行项，已用下述完整适用补跑补齐；不能把原轮称全绿。失败保留实际结果，不宣称全绿；基线签名及探索轮中断分别记录。完整回归对应上列源码，之后若仅增加本证据/公告元数据，交付head与其差异需在Issue另列。

## 逐项结果

| 组 | 命令（server目录） | 退出码 | 实际计数 |
| --- | --- | --- | --- |
| node | `node --test` | 0 | {"tests": 702, "pass": 702, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| question-bank | `node scripts/verify-question-bank-browser.js` | 0 | {"bank": 392, "local": 192, "mockTutorRouting": 200} |
| week1 | `node scripts/verify-week1-browser.js` | 1 | {"layouts": 50, "favorites": 2, "motion": 3, "failures": 44} |
| week2 | `node scripts/verify-week2-browser.js` | 0 | {"checks": 144, "failures": 0} |
| tutor | `node scripts/verify-tutor-browser.js` | 0 | {"reportedCases": 9} |
| animation | `node scripts/verify-animation-browser.js` | 0 | {"variants": 6} |
| announcements | `node scripts/verify-announcements-browser.js` | 0 | {"reportedPassLines": 8} |
| formula | `node scripts/verify-formula-browser.js` | 1 | {"layouts": 11, "mockAi": 0} |
| ai-quality | `node scripts/verify-ai-quality-browser.js` | 1 | {"reportedCases": 17} |
| share | `node scripts/verify-share-browser.js` | 0 | {"checks": 14} |
| instant | `node scripts/verify-instant-browser.js` | 0 | {"reportedPassLines": 13} |
| instant-routing | `node scripts/verify-instant-routing-browser.js` | 0 | {"reportedPassLines": 8} |
| tutor-diagram | `node scripts/verify-tutor-diagram-browser.js` | 0 | {"cases": 19} |
| tutor-presentation | `node scripts/verify-tutor-presentation-browser.js` | 0 | {"cases": 27} |
| incline-guard | `node scripts/verify-incline-diagram-browser.js --guard-only` | 1 | {"cases": 6} |
| incline-core | `node scripts/verify-incline-diagram-browser.js` | 0 | {"cases": 7} |
| incline-render | `node scripts/verify-incline-diagram-browser.js --render` | 0 | {"cases": 11} |
| incline-competition | `node scripts/verify-incline-diagram-browser.js --competition` | 0 | {"cases": 19} |
| incline-data | `node scripts/verify-incline-diagram-browser.js --data` | 0 | {"cases": 32} |
| chemistry-model | `node --test test/chemistry-experiments.test.js` | 0 | {"tests": 20, "pass": 20, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| chemistry-browser | `node scripts/verify-chemistry-browser.js` | 1 | {"checks": 198, "layouts": 6} |
| math-model | `node --test test/math-experiments.test.js` | 0 | {"tests": 23, "pass": 23, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| math-browser | `node scripts/verify-math-experiments-browser.js` | 0 | {"checks": 272, "layouts": 12} |
| experiment-layout | `node scripts/verify-experiment-layout-browser.js` | 0 | {"reportedCases": 97, "cases": 58} |
| unit-circle-model | `node --test test/unit-circle.test.js` | 0 | {"tests": 64, "pass": 64, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0} |
| unit-circle-browser | `node scripts/verify-unit-circle-browser.js` | 0 | {"checks": 219, "layouts": 15} |

旧guard-only五项均为原坐标请求预期1/实际0；干净当前master同样失败，其原共享布局46例通过。没有删除、跳过或放宽该五项。移动动画夹具另将明确的四种一次性布局回调与实验时钟分别审计，原单时钟上限仍为1，新增布局无自递归及离开后静止检查。

## 可直接查看的页面

每图来自同一源码的Chromium实际页面：视口1366/820/390，图片裁取完整实验卡片，像素尺寸不等于视口宽度。手机只保留一个全屏入口；参数与长场景可滚动到达。全屏和触控证据见结构化摘要。

### pythagoras · 1366

![pythagoras 1366](pythagoras-1366.png)

### pythagoras · 820

![pythagoras 820](pythagoras-820.png)

### pythagoras · 390

![pythagoras 390](pythagoras-390.png)

### arithmeticSum · 1366

![arithmeticSum 1366](arithmeticSum-1366.png)

### arithmeticSum · 820

![arithmeticSum 820](arithmeticSum-820.png)

### arithmeticSum · 390

![arithmeticSum 390](arithmeticSum-390.png)

### unitCircle · 1366

![unitCircle 1366](unitCircle-1366.png)

### unitCircle · 820

![unitCircle 820](unitCircle-820.png)

### unitCircle · 390

![unitCircle 390](unitCircle-390.png)


## 原轮、基线与适用补跑分开记录

完整26组对应00f00d8。干净当前master完整22组对照（无新增数学四组）另列于JSON，原44条week1、旧手机导师入口、外部字体CSP和五条guard失败逐项核对，不混作新数学回归。

9e7be00只调整3个验收夹具及公告元数据：手机选择实际可见的展开/问答页入口，化学离线HTML移除可选外部字体。原科学/公式/字号/控制台断言均保留。后续实际完整补跑formula、ai-quality、chemistry、announcements；公式69个布局、5个模拟AI场景全部执行，ai-quality 17/17、化学专项及公告通过。原轮提前中止后漏掉的58个公式布局和5个AI场景已经补齐。原轮失败仍保留。

补跑后仍失败的是基线已有的week1字号/参数44条、公式的手机平抛上下标字号断言、guard-only五条请求计数；同一完整公式夹具仅切换根目录到干净master，得到同样失败签名。保留当前master UI及原断言，不把这三组写成通过；PR继续Draft待审，尚未验收。

后续证据提交只更改本目录及验收文档。00f00d8的产品代码与9e7be00产品代码相同（web仅公告元数据不同）；测试夹具差异、逐次命令/退出码/计数及完整执行时间在JSON明确列出，未将旧源码SHA冒称为最终head。三尺寸九图保持同一00f00d8源码及同一PNG，不随报告更新换图。
