# 遗传教材题型重设计：题面、手算与页面预览

日期：2026-11-28（Asia/Shanghai）。本轮为**样式与教学送审**，不是产品实现或验收通过。

本轮任务与验收入口为 [Issue #13](https://github.com/yanyucheng-master/ai-science-studio/issues/13)。[旧PR #12的综合退回审查](https://github.com/yanyucheng-master/ai-science-studio/pull/12#pullrequestreview-6089895559)保留作旧稿记录；此前在Issue #11发出的设计资料不作为新版任务的验收入口。

按负责人本轮要求，旧版 P01–P06 不作为新题库或界面基底。从实际获取的 `origin/master` 新建 `codex/genetics-textbook-v2`，基线为 `ef7af5d8df18e66b2631a4c117abf959c221a0f9`。旧版遗传系谱入口保持撤下。本分支先放独立审阅页面，不登记模板、不改菜单、题库、分享服务、后端或模型配置。

- [两道主例的交互预览](preview/index.html)：点成员、四步讲题、明确分开的题后概率变式。
- [教材正文定位与参考核查](textbook-map.md)。
- [六模块题面、全家系数据与独立答案](questions-and-answers.md)。
- [组合矩阵、逐文件计划与后续验收](implementation-plan.md)。
- [本次实际预览核查及精选证据](evidence/README.md)。

第一轮重点审查两例：p35三代红绿色盲家系，以及p38白化病＋红绿色盲联合题。其余四模块已交题面和演算设计，尚未制作可操作产品入口。预览里的四步与题后问法可以操作；收藏、分享、自由题解析、组合面板、导师和产品播放器均尚未接入，不能用本页检查结果代替这些验收。

后续顺序：**先将本轮题面、手算与预览放入关联Issue #13的新独立Web Draft，供样式与教学验收；通过后再在该Draft补齐产品实现和全量适用回归。** 创建Draft不代表产品完成，不沿用旧版PR的产品完成声明。本轮不合并、不推主线或公网、不部署、不恢复自动化。

在仓库根目录用任意只读静态服务器打开 `/docs/genetics-textbook-v2/preview/index.html`。本地检查脚本会自行启动只绑定 `127.0.0.1` 的临时服务器，并使用全新浏览器上下文，不需要密钥或个人浏览器配置。
