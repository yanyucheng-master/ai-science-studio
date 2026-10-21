# Chemistry v1 验证记录

状态：实验一预览阶段，完整两实验交付尚未完成。功能分支 `codex/chemistry-two-experiments`，基线 `295d177992be0138a2ce284cbb3ecdf44b27dcc9`。用户已确认方案并明确取消等待负责人方案审查的前置条件；负责人审查仍待处理，本记录不是接纳、合并或发布批准。

## 环境及执行约束

Windows_NT 10.0.26200 x64，Node v24.19.0，Edge 155.0.4283.62，bundled Playwright。Node 子进程使用白名单环境变量，未继承真实 AI 密钥，不加载 `.env`。浏览器均使用独立临时 context，所有非本地请求被阻断，本地 API 使用模拟响应。没有真实 AI 请求、部署或个人浏览器配置访问。

本地回归驱动保存在仓库外 `.handoff/run-chemistry-regression.mjs`，依次调用仓库脚本并保存 stdout、stderr、起止时间、退出码和超时状态。不存在 npm 命令时直接调用等价 node 入口；未改产品依赖。

## 基线完整回归

从上述 SHA 的 `git archive` 建立独立未修改源码副本，2026-10-21T12:34:29Z–12:47:22Z 运行。19 组中 16 组通过、3 组失败、0 组整组超时；原始汇总：

`C:\Users\白夜\Documents\ChatGPT\ai实验室\.handoff\chemistry-v1-evidence\295d177-baseline\summary.json`

| 检查 | 基线结果 |
| --- | --- |
| `node --test` | 595/595 通过，失败/取消/跳过/todo 均为0 |
| question-bank、week1、week2、announcements、formula、ai-quality、share | 通过 |
| instant、instant-routing、tutor-diagram、tutor-presentation | 通过 |
| incline 默认、`--render`、`--competition`、`--data` | 通过 |
| tutor | 失败：脚本第136行等待 pending/Stop 条件超时，待进一步核对夹具 |
| animation | 失败：第107行生成平抛题超时；测试静态资源清单缺 question-conditions，且题干未给 g |
| incline `--guard-only` | 失败：5处旧阶段断言要求坐标请求为1，当前本地斜面路径为0；默认/后续四阶段通过。保留失败，不改变断言掩盖不适用阶段 |

所有失败均是原始基线实际结果，不能记为功能分支通过，也不能据此跳过必要动画/导师验收。最终提交将重跑相同集合，另列必要测试接入修正及新旧差异。

## 实验一初步证据

开发中模型测试7/7通过；包括五组预先手算的计量/足量案例、质量守恒和比例检查、端点、20条缺条件/矛盾/未知所问/越界反例、学段与题目往返、中间态守恒。全 Node 在实验一接入后曾达到602/602通过；最终提交须重新对应 SHA 记录。

开发中浏览器专项第7轮通过54条断言，1366/820/390实际生成、终态读数、余量、足量锁定、场景区域/文字/控件几何、手机和平板分享入口、播放/暂停/继续、主动重置、独立 context 分享及导师确定性上下文通过。该轮报告：

`C:\Users\白夜\Documents\ChatGPT\ai实验室\.handoff\chemistry-v1-evidence\caco3-preview-7\chemistry-browser\report.json`

同目录包含 `caco3-1366.png`、`caco3-820.png`、`caco3-390.png`、三张足量模式截图及三张铁/硫酸铜对照。初稿人工看图曾发现通用数学 span 样式把化学符号拆行、SVG 字号继承过大，已收窄局部选择器并修正字号；最终截图仍须人工复核。基线原样对照截图、最终 SHA 的完整回归、真实 BFCache 命中、完整收藏/学段/菜单/状态恢复与新实验二仍在后续验收清单，不能用这54条代替全部任务。

这些开发轮次测试的是未提交补丁，日志如实标注；后续记录以最终提交 SHA 的验证为准。原始报告与截图不提交到 Git。
