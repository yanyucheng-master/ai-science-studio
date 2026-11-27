# 实验短链接

公网网页复制 /s/<10 位短码>，沿用大师实验室现有域名。静态站将该路径转入 /?s=<短码>，网页读取实验记录，并用现有的实验校验流程恢复题目、学段、模式和参数。完整链接继续按原格式恢复。创建短码失败或超时，按钮会自动复制完整链接。

## 有效期和清理

每条短链接在创建后满 24 小时停止提供读取。独立的 Render Web Service 使用同区 PostgreSQL。服务启动时和运行期间每小时清理到期记录一次。免费 Web Service 休眠时，由下一次启动清理已经到期的记录。

Render 免费数据库在创建 30 天后到期。将 SHARE_STORAGE_END 设为这个实例的到期时刻，并预留操作余量。在服务不能为新记录保留完整 24 小时时，创建接口自动暂停，现有记录仍能按各自的有效期读取。Render 上初始缺少该变量时，服务可启动但暂停创建短链。

免费 Web Service 的首次唤醒可能耗时约一分钟。短链读取显示等待提示并重试。创建请求等待最多约 4 秒，随后用完整链接回退。

## 本地验证

在 share-service 目录使用 Node.js 22 或更新版本运行以下命令。验收脚本使用本机的 PostgreSQL 引擎并启动环回地址服务，浏览器沿用 PLAYWRIGHT_MODULE 和 BROWSER_CHANNEL，默认使用 Edge。

    npm ci
    node verify-local.mjs

## Render 配置

render-short-share.yaml 为独立 Blueprint，只包含短链 API 与它的数据库。通过 fromDatabase 使用 Render 内部连接。生产的数据库凭据由 Render 注入 DATABASE_URL。服务对 /health 提供 HTTP 健康检查。

正式静态站由 Render 单独管理。上线时核对 /s/* 到 /?s=* 的规则，以及 web/short-share-config.js 中的 API 地址。应分别确认 API 与静态站的部署，接着在公网网页复制短链并验证新会话可以恢复实验。
