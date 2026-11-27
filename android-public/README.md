# 公网 Android 安装包

应用通过 Android 浏览器的 Custom Tabs 打开正式 Demo。缺少 Custom Tabs 支持时使用系统浏览器。实验与 AI 服务的更新由公网部署生效，用户可在页面菜单中刷新。需要检查网页时，可在使用 Android Chrome 的设备上开启 USB 调试，在电脑 Chrome 的 `chrome://inspect/#devices` 选择实验室页面。

启动页会在首次打开、距上次检查五分钟后重新返回时读取同站的 `/android/latest.json`。用户也可随时手动重查。只有更高的 `versionCode` 才会显示下载按钮，下载目标固定为同站的版本化 APK。浏览器负责下载，用户通过 Android 系统安装器确认覆盖安装。

## 发布新版 APK

在原签名 Windows 用户下，配置 JDK 21 的 `JAVA_HOME` 与 Android SDK 的 `ANDROID_HOME`，安装 Android Platform 35 和 Build Tools 36.1.0。运行以下命令时递增内部版本号，并指定面向用户的三段版本号。

```powershell
.\android-public\build.ps1 -VersionCode 2 -VersionName 1.0.1
```

脚本读取 Windows 用户本地的签名库与 DPAPI 保护的口令，验证签名证书指纹、APK 签名及对齐，生成 `web/android/master-lab-<versionCode>.apk` 并更新 `latest.json`。保留旧文件，让仍在查看旧清单的手机可以完成下载。签名库及恢复用凭据由发布者私下备份，系统的覆盖安装要求包名与签名持续一致。

在公网分支的隔离 worktree 中，按 `docs/render-publish.md` 将新版 APK、清单、对应公告及本轮源码一起发布。固定下载页为 `/android/index.html`。
