# 数学与最新 UI 验收记录（2026-10-23）

测试源码：`8b9453a4da2939b04b4acccd47599f4bdeccd559`（Git tree `5e1504b2d2f1206660209feb17b8ee51a7f171e7`）。完整执行前已提交，执行期间产品/测试源码未再改动。后续提交只追加本报告及公告中的内部验收条目（revision 2），不改功能或测试实现；不把后续 head 混称为完整回归执行版本。公告补充后的专项结果另在 PR 中按实际提交 SHA 记录。

基线：`7654ce2a3e6d2e6ae833430b32a11ea62fb60ddb`。环境：Windows_NT 10.0.26200 x64；Node v24.22.1；Edge 155.0.4283.62；独立 Chromium 151.0.7922.34。开始 2026-10-23T10:28:22.269Z，结束 2026-10-23T10:45:26.071Z（UTC）。

23组完整适用脚本：22通过、1失败、0超时、0未执行。失败为1组已在干净基线复现的旧斜面guard-only，含5个失败断言；不宣称全绿。

## 实际命令与退出码

命令在仓库 server 目录，以只含系统运行所需变量的白名单环境执行；未设置BANK_FILTER，不读取.env，不使用个人浏览器配置。各组独立本地服务器与模拟响应，不发真实AI请求。用例总数仅引用脚本实际输出；退出码是各子进程实际值，不能以外层汇总脚本退出0代替。

| 组 | 实际命令 | 退出码 | 结果/显式计数 |
| --- | --- | --- | --- |
| node | `node --test` | 0 | passed；633/633通过，0失败 |
| question-bank | `node scripts/verify-question-bank-browser.js` | 0 | passed；376题（本地185，转导师191） |
| week1 | `node scripts/verify-week1-browser.js` | 0 | passed |
| week2 | `node scripts/verify-week2-browser.js` | 0 | passed |
| tutor | `node scripts/verify-tutor-browser.js` | 0 | passed |
| animation | `node scripts/verify-animation-browser.js` | 0 | passed |
| announcements | `node scripts/verify-announcements-browser.js` | 0 | passed |
| formula | `node scripts/verify-formula-browser.js` | 0 | passed |
| ai-quality | `node scripts/verify-ai-quality-browser.js` | 0 | passed |
| share | `node scripts/verify-share-browser.js` | 0 | passed |
| instant | `node scripts/verify-instant-browser.js` | 0 | passed |
| instant-routing | `node scripts/verify-instant-routing-browser.js` | 0 | passed |
| tutor-diagram | `node scripts/verify-tutor-diagram-browser.js` | 0 | passed |
| tutor-presentation | `node scripts/verify-tutor-presentation-browser.js` | 0 | passed |
| incline-guard | `node scripts/verify-incline-diagram-browser.js --guard-only` | 1 | failed；5个基线失败断言 |
| incline-core | `node scripts/verify-incline-diagram-browser.js` | 0 | passed |
| incline-render | `node scripts/verify-incline-diagram-browser.js --render` | 0 | passed |
| incline-competition | `node scripts/verify-incline-diagram-browser.js --competition` | 0 | passed |
| incline-data | `node scripts/verify-incline-diagram-browser.js --data` | 0 | passed |
| chemistry-model | `node --test test/chemistry-experiments.test.js` | 0 | passed；20/20通过，0失败 |
| chemistry-browser | `node scripts/verify-chemistry-browser.js` | 0 | passed |
| math-model | `node --test test/math-experiments.test.js` | 0 | passed；18/18通过，0失败 |
| math-browser | `node scripts/verify-math-experiments-browser.js` | 0 | passed；93项断言 |

## 基线失败与新增范围

干净基线通过Git archive导出，实际执行 `node scripts/verify-incline-diagram-browser.js --guard-only`，退出1。与本轮源码的失败名称、坐标请求次数和断言签名完全一致：

- original-1366：预期1次旧坐标请求，实际0次；`0 !== 1`。
- original-820：预期1次旧坐标请求，实际0次；`0 !== 1`。
- original-390：预期1次旧坐标请求，实际0次；`0 !== 1`。
- personal-original：预期1次旧坐标请求，实际0次；`0 !== 1`。
- supported-session-and-tampering：预期1次旧坐标请求，实际0次；`0 !== 1`。

当前斜面core/render/competition/--data及三套绘图入口均实际执行，结果如上；没有为报绿跳过、删除或改弱旧断言。本轮没有修改斜面实现或上述guard脚本。首轮工作树探索结果与本表分开保留，不冒充最终提交执行证据。

## 两数学模板、状态与布局证据

新增数学单元18/18；独立Edge和Chromium各93/93项页面断言通过。额外实际跨浏览器验证由Edge155生成两份链接，在独立Chromium151导入，2/2通过：

- pythagoras：当前参数[6,8]，结果10；导入后主动重置为原题[3,4]。
- arithmeticSum：当前参数[-3,5]，结果-50；导入后主动重置为原题[2,10]。

实际页面覆盖1366/820/390、初中/高中菜单、两参数、播放/暂停/继续与空格、主动重置、学科往返、收藏当前比较配置后再生成、当前/原题导师区分、未知新题可见拒绝并保留原实验、独立导入、AI页往返、等价编码、A→B→A、旧学科等待→A、刷新及真实BFCache。

两模板的真实前后台切换已加入animation脚本：后台无待执行动画帧、时间不推进；回来后继续，maxPending=1。截图和有意义的DOM断言同时检查页面无横向溢出、场景不裁切、文本和区域不重叠、控件有可用几何尺寸，以及播放/场景/参数顺序。六张最终截图已本地逐张核对。

基线和最终版本的化学模型专项均为20/20，化学浏览器专项通过；数学专项还在三种宽度再次核对CaCO₃的4.4g和NaCl的10g盐/90g水，未抢占化学识别。化学功能模型保持基线内容，原有铁/硫酸铜同宽度图作为参照。

最终数学截图SHA256（图片不提交，原图位于工作区旁的 `.handoff/math-ui-final-8b9453a/math-browser/`）：

| 文件 | SHA256 |
| --- | --- |
| pythagoras-1366.png | `34c95c2683988e7df3daffbb3981623a671b3381689ccbe5c7c4cadc9aeab1eb` |
| arithmeticSum-1366.png | `3c8ad78a52d18f80581fa35c8ae64f5e06a97fc52380180dbce5236e39f86f0b` |
| pythagoras-820.png | `5637975852df65710f82b398893eaf21057d2272045af51f90c524e74b054bb3` |
| arithmeticSum-820.png | `5cd1518fc152c62d95b4fe1770abd14ae1d634b25f852fd11deb708d1a433498` |
| pythagoras-390.png | `a190f4d3200fd02e0cec26b421bee74e04117d46de030a1f36a8538e84c3037e` |
| arithmeticSum-390.png | `d0c078d5a0d35df6be788d240a9a5d4c48975edcdf37f2031cb31cd17a7b444a` |

## 公网、源码和交付边界

公网只读截图确认新UI；实际公网CSS与fetch到的master和公网分支CSS的SHA256相同：`dd54040fae9d846e20bfdfc5d36ebd6082645c9c05a49aeb19ed73092d8ea969`。未将资源内容相同推断为Render的Live提交SHA。所有开发和功能验证在本地进行，没有公网功能写入、真实AI请求、合并、master/公网分支推送或部署。

数学内容和参数限制见[实现说明](math-experiments.md)。完整脚本在Windows/Edge执行，另补独立Chromium数学验收；未执行Firefox、Safari、移动真机和live模型评测，不把这些算已完成。化学v2教材待核与审查继续保留。

原始报告与stdout/stderr位于工作区旁 `.handoff/math-ui-final-8b9453a/`；少数旧脚本的固定产物目录为仓库本地artifacts/。基线guard和跨浏览器报告分别在 `.handoff/math-ui-baseline-guard-7654ce2/` 与 `.handoff/math-ui-cross-browser-8b9453a/`。均未提交。GitHub Actions与check-runs实际查询均为0条，不能据此声称CI、密钥扫描或签名检查通过。
