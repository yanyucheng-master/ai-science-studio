# 公网 Android 安装包

Android 1.1.0 在应用内的系统 WebView 运行包内实验。首页、脚本、公式字体、3D 模块和公告随 APK 安装。基础实验走本地模板，AI 问答、未匹配题目的 AI 分析及照片识题使用公网服务。建议更新系统 WebView，立体视图需要设备支持 WebGL 2。网页内的收藏和设置保存在本应用，1.0.0 使用过的浏览器数据不会自动迁入。

启动应用、距上次检查五分钟后重新进入前台时，应用读取正式站点的 `/android/latest.json`。在首页打开铃铛再点“检查安装包更新”可立即检查。版本号更高时提供同站 APK 下载，用户在系统安装器确认覆盖安装。Android 10 及以上优先写入系统“下载”文件夹，较早系统交由浏览器下载。实验资源更新随新版 APK 发布。

调试实验页面时，先在手机开发者选项启用 USB 调试并授权电脑，在应用的版本对话框点“开启 USB 调试”，然后在电脑 Chrome 的 `chrome://inspect/#devices` 选择大师实验室。关闭应用进程会关闭本次网页调试。

## 发布新版 APK

在原签名 Windows 用户下，配置 JDK 21 的 `JAVA_HOME` 与 Android SDK 的 `ANDROID_HOME`，安装 Android Platform 35 和 Build Tools 36.1.0。运行以下命令时递增内部版本号，并指定面向用户的三段版本号。

```powershell
.\android-public\build.ps1 -VersionCode 3 -VersionName 1.1.1
```

脚本读取 Windows 用户本地的签名库与 DPAPI 保护的口令，验证签名证书指纹、APK 签名及对齐，生成 `web/android/master-lab-<versionCode>.apk` 并更新 `latest.json`。保留旧文件，让仍在查看旧清单的手机可以完成下载。签名库及恢复用凭据由发布者私下备份，系统的覆盖安装要求包名与签名持续一致。

在公网分支的隔离 worktree 中，按 `docs/render-publish.md` 将新版 APK、清单、对应公告及本轮源码一起发布。固定下载页为 `/android/index.html`。
