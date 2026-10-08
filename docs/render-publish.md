# Render 公网发布

正式 Demo：<https://ai-science-studio.onrender.com/>。

## 发布来源

2026-10-04 核验 Render 控制台与部署日志后确认：

- 仓库：`yanyucheng-master/ai-science-studio`。
- 静态服务：`ai-science-studio`，服务 ID `srv-d8nsa3egvqtc73e3hekg`。
- 发布分支：`codex/public-demo-byo-key`。
- 发布目录：`web`，Root Directory 留空，不需要构建命令。
- 自动部署：On Commit，无路径过滤。

`master` 与公网分支包含不同的更新。公网分支有独立的 AI 导师改进，包括公益默认服务与个人密钥优先、Flash max 思考及解答呈现。把 Render 直接切换到 `master` 会回退这些功能。

## 发布流程

1. 核对 Render 当前的仓库、分支与 Live 提交；`render.yaml` 不能代替控制台核验，手动创建的服务不会因该文件变化而自动同步全部配置。
2. 在隔离工作区把需要上线的提交同步到公网分支。若首页的资源版本号发生冲突，应同时保留新的公告/图标资源引用和公网现用的 AI 导师脚本版本。
3. 对照完整发布差异同步维护 `web/announcements.json`，写明每轮已经完成的更新；新增唯一 `id`，修订旧内容时增加 `revision`。保留公网分支已有的 AI 路由与回答行为，公告不能声称未在该分支完成的改动。具体规则见 [更新公告](announcements.md)。
4. 仅暂存审核过的明确文件清单，执行 `node server/scripts/check-announcement-release.js --base HEAD --staged`；提交后针对 fetch 到的目标远端引用执行同一脚本的 `--committed` 检查，核对完整待推送范围，然后正常推送。默认不运行本地测试或浏览器回归，保留原有 GitHub 自动 CI；用户明确要求功能验证时再执行相应测试。不要提交本地 `artifacts/`、设计候选或密钥，不要强制推送。
5. 在 Render 等待该提交显示 `Deploy succeeded | Live`，检查日志中的完整提交 SHA。
6. 用普通 URL 与唯一查询参数 URL 核验本次更新涉及的公网文件，必须包含公告 JSON 和页面实际引用版本的公告脚本。核对新公告的标识、修订号、日期及内容；需要用户界面验证时打开首页及公告窗口。实测响应头与 `render.yaml` 可能不同，应分别记录，不能把仓库缓存声明当作线上已生效。

GitHub 推送成功与公网更新成功是两个验收步骤。手动部署也只会发布 Render 当前监听的分支，不能把另一个分支的提交带上线。

本流程只涉及正式 Demo 的静态站点。前端更新不需要重新部署 AI 后台或修改其环境变量。
