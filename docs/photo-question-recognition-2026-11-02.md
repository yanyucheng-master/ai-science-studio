# 拍照与照片上传识题（2026-11-02）

## 代码范围

新增拍照、文件选择、图片校验与压缩、识别状态和取消。结果只填入输入框，由用户核对后点击“生成实验”。手机使用系统拍照入口，电脑使用页内取景框；具体兼容性取决于设备和浏览器。支持 JPG、PNG、WebP，原文件不超过 20MB，发送前缩到最长边 1920px、目标约 1.5MB。

`POST /api/v1/question/recognize` 只接受图片 data URL，不允许外部图片 URL。请求体上限 3MiB、图片上限 2MiB。`RECOGNIZE_RATE_LIMIT_MAX=12`（沿用 `RATE_LIMIT_WINDOW_MS`，默认 10 分钟）、`RECOGNIZE_MAX_CONCURRENT_REQUESTS=2`（范围 1–4）、`RECOGNIZE_TIMEOUT_MS=45000`。既有文字接口仍使用 16KiB 上限。地址归属沿用现有可信代理配置，不擅自变更代理层数；若 `TRUST_PROXY_HOPS=0` 且位于共享代理后，识题频率可能合并计数。

图片只发给 `deepseek-flash` 的 user 消息，关闭思考，要求 JSON 结果；无法解析、字段类型错误或不完整结束的结果返回错误。转写保留数学比较符号，看不清字符用 `[?]`，最多 1500 字，截断时前端提醒。网关不在日志或磁盘保存照片与转写正文。识题有独立并发上限，不改变原导师的模型、max 思考、重试、并发和超时设置。

协议依据：[DeepSeek Vision 官方文档](https://api-docs.deepseek.com/guides/vision/)。模型支持图片不等于本项目识题准确率已验收。

## 发布与部署位置

- `master`：通用开发代码，维持其 AI 配置。
- `codex/public-demo-byo-key`：正式 Demo 前端，通过独立工作区同步识题页面、脚本、样式与公告，保留原公益服务与个人密钥优先行为。公益网关地址为 `https://masterlab-harmony-ai-2026.onrender.com`。
- `codex/harmony-flash-max`：公益网关，仅移植识题接口及独立限制，保留原有行为。

本轮读取 Render 实际配置：静态服务 `srv-d8nsa3egvqtc73e3hekg` 监听公网分支，目录 `web`，自动部署 On Commit；网关服务 `srv-daue6cflot8c73aq28l0` 监听网关分支，Root Directory 为空（仓库根），Build 为 `npm ci --prefix server`，Start 为 `npm start --prefix server`，自动部署关闭。均属于用户确认的 MASTER LAB 工作区。

部署后读取 `/health`，应有 `photoRecognition.configured` 及图片、请求体、并发限制，此检查不会调用付费模型。静态服务需核对 Live 提交及页面实际引用脚本、样式和公告与提交一致。

## 验证边界

本轮按项目默认约定只做语法、差异及公告静态核查；未运行本地功能测试、浏览器回归或真实 AI。随代码移植并修订的单元测试未在本轮执行，上一轮模拟结果不能证明本轮通过。真实习题照片的转写质量、手机真机与相机权限流程仍待对应验收。

部署成功需以实际 Live 状态和公开响应为准；本文件描述代码及发布检查项，不将提交或推送等同于上线。
