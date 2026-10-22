# Chemistry v1 验证记录

本页及精选图片对应的测试源码提交：`c4934efc0357aa191117ffe9a7966a149047a205`；基线：`295d177992be0138a2ce284cbb3ecdf44b27dcc9`。该源码由 git archive 导出后验证。[脱敏 JSON 汇总](chemistry-v1-evidence/summary.json) 的 codeTree.sha256 记录此源码的 web/server Git blob 清单。后续证据提交仅增加文档、六张精选图、汇总及仓库规则要求的公告说明修订，不改模型、页面JS/CSS、测试或后端。最终PR head的完整回归结果另外随PR正文提供，不能将本页旧SHA伪称为最终head执行记录。负责人尚未接纳，未合并或发布。用户明确取消等待方案审查，另授权提交六张精选截图及脱敏报告；这不代表负责人批准实现。

环境：Windows_NT 10.0.26200 x64，Node v24.19.0，Edge 155.0.4283.62，Chrome for Testing 151.0.7922.34，bundled Playwright。两浏览器同属 Chromium，不能称为跨引擎验证。Node 子进程仅继承系统白名单环境，不加载 .env；独立浏览器 context/临时配置，全程本地服务器与模拟 API，不读取真实密钥或个人浏览器资料，不发真实 AI 请求。

完整集合起止：2026-10-22T01:48:54.994Z–2026-10-22T02:05:13.627Z。21组：20通过，1失败，0整组超时。Node 612/612通过，失败/取消/跳过/todo均为0；化学模型17组全部通过；题库330题通过。Edge化学专项158条，Chrome专项158条，页面/控制台错误和真实AI请求均为0。

| 实际命令（server目录） | 结果 | 整组超时 |
| --- | --- | --- |
| `node --test` | 通过 | 否 |
| `node scripts/verify-question-bank-browser.js` | 通过 | 否 |
| `node scripts/verify-week1-browser.js` | 通过 | 否 |
| `node scripts/verify-week2-browser.js` | 通过 | 否 |
| `node scripts/verify-tutor-browser.js` | 通过 | 否 |
| `node scripts/verify-animation-browser.js` | 通过 | 否 |
| `node scripts/verify-announcements-browser.js` | 通过 | 否 |
| `node scripts/verify-formula-browser.js` | 通过 | 否 |
| `node scripts/verify-ai-quality-browser.js` | 通过 | 否 |
| `node scripts/verify-share-browser.js` | 通过 | 否 |
| `node scripts/verify-instant-browser.js` | 通过 | 否 |
| `node scripts/verify-instant-routing-browser.js` | 通过 | 否 |
| `node scripts/verify-tutor-diagram-browser.js` | 通过 | 否 |
| `node scripts/verify-tutor-presentation-browser.js` | 通过 | 否 |
| `node scripts/verify-incline-diagram-browser.js --guard-only` | 失败：同基线历史不适用断言 | 否 |
| `node scripts/verify-incline-diagram-browser.js` | 通过 | 否 |
| `node scripts/verify-incline-diagram-browser.js --render` | 通过 | 否 |
| `node scripts/verify-incline-diagram-browser.js --competition` | 通过 | 否 |
| `node scripts/verify-incline-diagram-browser.js --data` | 通过 | 否 |
| `node --test test/chemistry-experiments.test.js` | 通过 | 否 |
| `node scripts/verify-chemistry-browser.js` | 通过 | 否 |

基线同集合19组16通过、3失败。tutor与animation的夹具静态资源清单缺少现有条件组件等文件；动画平抛题还缺明确g。补齐实际资源并明确g=9.8后保留原断言，最终重跑通过。新增真实后台切换检查覆盖两新模板，隐藏时待执行动画帧0、前台恢复1、最大1，暂停归零。初期诊断的第二帧来自Playwright的RAF轮询，调用栈指向UtilityScript/next；改用时间轮询，不排除页面动画回调或放宽最大1断言。

incline --guard-only仍失败：五处历史AI坐标请求断言要求1，当前本地斜面实际0；与未修改基线一致。保留原入口和失败记录，没有跳过、删除或弱化断言。当前斜面的默认/render/competition/data及instant、instant-routing、tutor-diagram均另行执行并通过。不能把这条历史阶段记成全绿。原始stdout/stderr、完整报告、其他截图及开发轮次保存在开发侧仓库外，不提交；公开汇总提供每项命令、起止、退出码与计数。Chrome初次启动因相对浏览器路径错误未执行，改绝对路径后的完整专项通过。

## 审查退回项的实际修复与反例

P1：10g CaCO₃与盐酸反应后剩余HCl3.65g，不能把余量当初始HCl；反应后剩余CaCO₃10g或已消耗CaCO₃5g也不能当初始投入。三题预期均拒绝本地实验，实际均拒绝并保留当前实验；没有增加逆向求解。单元另覆盖耗去/耗用/用去/用掉/反应掉/剩下/余下/残余/未参与反应和合法初始质量正例。质量先绑定物质及初始/消耗/余量角色，再做文字白名单校验；所问前的已知条件同时检查数值后“（剩余质量）”“为消耗质量”“（反应后）”等后置说明，避免前缀绑定漏掉等价条件。后置边界也加入题库及实际浏览器反例。

P2：10g CaCO₃+足量稀盐酸，只问消耗HCl：预期/实际7.3g；足量CaCO₃+HCl溶质3.65g，只问消耗CaCO₃：预期/实际5g；10g CaCO₃+HCl3.65g组合所问：CO₂2.2g、耗CaCO₃5g、耗HCl3.65g、余CaCO₃5g。初高中均在模型、命名答案、实际步骤、导师确定性上下文核对，且生成题目往返保留所问。修复提交为本页测试源码提交。

独立手算另含10g CaCO₃+足量盐酸→CO₂4.4g、+HCl7.3g恰好反应、+HCl3.65g→CO₂2.2g余CaCO₃5g；NaCl配制100g10%→盐10g水90g、50g6%→3g/47g、200g5%→10g/190g、100g0%→0g/100g。比例、质量/元素守恒、上下界、非法单位/缺条件/额外子问/未知余量、四位小数精度和微小非零读数均有反例。

## 状态、交互与可见证据

专项实际操作菜单、学段、参数、播放/暂停/继续、时间轴、原题重置、收藏后重新生成、学科快照、独立浏览器分享、AI页往返、等价编码、A→B→A、旧学科等待→A、刷新及篡改锁定参数拒绝；当前比较参数与受检原题分别保留。直接输入新学科题目会先保存旧实验参数，另核对原有数学收藏及导师消息/草稿保留。导师模拟请求通过页面展开及更多/全屏入口发送，包含当前确定性结果。

真实BFCache使用无请求路由的隔离context，以CSP限制外部连接，实际记录pageshow.persisted=true；两模板在活动上下文返回时保留调整，离开上下文后返回重新导入原分享。不是人工派发pageshow事件。NaCl阶段测试核对称盐、称水、干盐加入、加水和混匀的每处质量，0%没有盐粒；reduced-motion下无移动气泡或搅拌棒。

1366/820/390分别保留截图和DOM几何断言：无横向溢出、场景与说明无越界、区域不重叠、文字不裁切、控件有可用尺寸。同一基线铁/硫酸铜三宽对照截图保存在原始证据中；页面复用既有主题、卡片与控件。下列为用户授权提交的六张最终精选；只截实验卡片，宽度指浏览器viewport，不是图片裁剪宽度。浏览器字体为本地回退字体，外部字体请求被阻断。

| 实验 | 1366 | 820 | 390 |
| --- | --- | --- | --- |
| 碳酸钙/盐酸 | [桌面](chemistry-v1-evidence/caco3-1366.png) | [平板](chemistry-v1-evidence/caco3-820.png) | [手机](chemistry-v1-evidence/caco3-390.png) |
| NaCl配制 | [桌面](chemistry-v1-evidence/nacl-1366.png) | [平板](chemistry-v1-evidence/nacl-820.png) | [手机](chemistry-v1-evidence/nacl-390.png) |

未执行：真实AI/live评测（不在授权范围）、Firefox/WebKit（本环境未安装）、负责人独立验收、合并和公网发布。没有通过跳过适用测试宣称完成，也未修改后端协议、模型配置、鸿蒙或部署设置。GitHub远端与CI状态以PR交付评论的实际核对为准，本地测试不代替CI或接纳。
