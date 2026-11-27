package cn.masterlab.publicdemo;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JsPromptResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends Activity {
    private static final String RELEASES = LabAssets.HOME + "android/";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private WebView lab;
    private LabFiles files;
    private int installedCode, availableCode, announcedCode;
    private String installedName, availableName;
    private boolean resumed, checking, manualResult, debugging;
    private long lastCheck = -1;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.main);
        View root = findViewById(R.id.root);
        if (Build.VERSION.SDK_INT >= 35) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() |
                    WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            installedCode = info.versionCode;
            installedName = info.versionName;
        } catch (PackageManager.NameNotFoundException impossible) { throw new IllegalStateException(impossible); }

        files = new LabFiles(this);
        lab = findViewById(R.id.lab);
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = lab.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        lab.setWebViewClient(new LabAssets(getAssets()));
        lab.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (LabAssets.isLabPage(Uri.parse(view.getUrl()))) files.choose(params.isCaptureEnabled(), callback);
                else callback.onReceiveValue(null);
                return true;
            }
            @Override public boolean onJsPrompt(WebView view, String url, String message, String value, JsPromptResult result) {
                if (!LabAssets.isLabPage(Uri.parse(url))) { result.cancel(); return true; }
                if ("masterlab-android/update".equals(message)) {
                    result.confirm("");
                    checkRelease(true);
                    return true;
                }
                if ("masterlab-android/export".equals(message)) {
                    result.confirm("");
                    if (value != null && value.length() <= 4_000_000) files.save(value);
                    else toast("对话过长，无法导出。");
                    return true;
                }
                return super.onJsPrompt(view, url, message, value, result);
            }
        });
        if (state == null || lab.restoreState(state) == null) lab.loadUrl(LabAssets.HOME);
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        lab.saveState(state);
    }

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        lab.onResume();
        if (availableCode > announcedCode) showVersion(null);
        if (lastCheck < 0 || SystemClock.elapsedRealtime() - lastCheck >= 300_000) checkRelease(false);
    }

    @Override protected void onPause() {
        resumed = false;
        lab.onPause();
        super.onPause();
    }

    @Override public void onBackPressed() {
        lab.evaluateJavascript("Boolean(window.masterLabAndroid && window.masterLabAndroid.back())", closed -> {
            if (isFinishing() || isDestroyed() || "true".equals(closed)) return;
            if (lab.canGoBack()) lab.goBack();
            else super.onBackPressed();
        });
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        files.onResult(request, result, data);
    }

    private void checkRelease(boolean manual) {
        manualResult |= manual;
        if (manual) toast("正在检查安装包更新…");
        if (checking) return;
        checking = true;
        lastCheck = SystemClock.elapsedRealtime();
        worker.execute(() -> {
            try {
                JSONObject release = readRelease();
                int code = release.getInt("versionCode");
                String name = release.getString("versionName");
                if (code <= 0 || !name.matches("[0-9]+(\\.[0-9]+){2}") ||
                    !release.getString("apk").equals("master-lab-" + code + ".apk") ||
                    !release.getString("packageName").equals(getPackageName())) throw new IOException("Invalid release");
                runOnUiThread(() -> finishCheck(code, name, null));
            } catch (IOException | JSONException failure) {
                runOnUiThread(() -> finishCheck(0, null, "无法连接更新服务。可继续使用内置实验。"));
            }
        });
    }

    private void finishCheck(int code, String name, String error) {
        checking = false;
        boolean manual = manualResult;
        manualResult = false;
        if (isFinishing() || isDestroyed()) return;
        if (error == null) {
            availableCode = code > installedCode ? code : 0;
            availableName = name;
        }
        if (resumed && (manual || availableCode > announcedCode)) showVersion(error);
    }

    private void showVersion(String error) {
        int code = availableCode;
        announcedCode = code;
        AlertDialog.Builder dialog = new AlertDialog.Builder(this).setTitle("大师实验室 · " + installedName)
            .setNegativeButton("关闭", null)
            .setNeutralButton(debugging ? "关闭 USB 调试" : "开启 USB 调试", (d, which) -> {
                debugging = !debugging;
                WebView.setWebContentsDebuggingEnabled(debugging);
                toast(debugging ? "已开启本次网页调试，可连接电脑使用 Chrome 检查。" : "已关闭网页调试。");
            });
        if (code > installedCode) {
            dialog.setMessage("可更新至 " + availableName + "。下载完成后点开 APK，按系统提示覆盖安装。")
                .setPositiveButton("下载新版 APK", (d, which) -> download(code));
        } else dialog.setMessage(error != null ? error : "已是最新版本。实验内容随安装包更新。");
        dialog.show();
    }

    private void download(int code) {
        String filename = "master-lab-" + code + ".apk";
        Uri url = Uri.parse(RELEASES + filename);
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                manager.enqueue(new DownloadManager.Request(url).setTitle("大师实验室 Android 更新")
                    .setMimeType("application/vnd.android.package-archive")
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED));
                toast("已交给系统下载，可在下载通知或“下载”文件夹中打开。");
                return;
            } catch (RuntimeException unavailable) { /* Use the system browser if the download service is disabled. */ }
        }
        try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
        catch (ActivityNotFoundException missing) { toast("请在手机浏览器打开正式下载页获取更新。"); }
    }

    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_SHORT).show(); }

    private JSONObject readRelease() throws IOException, JSONException {
        URL url = new URL(RELEASES + "latest.json?t=" + System.currentTimeMillis());
        HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
        try {
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "application/json");
            if (connection.getResponseCode() != 200) throw new IOException("Release unavailable");
            try (InputStream in = connection.getInputStream()) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] chunk = new byte[1024];
                int count;
                while ((count = in.read(chunk)) != -1) {
                    if (bytes.size() + count > 8192) throw new IOException("Release file too large");
                    bytes.write(chunk, 0, count);
                }
                return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            }
        } finally {
            connection.disconnect();
        }
    }

    @Override protected void onDestroy() {
        worker.shutdownNow();
        files.finishPhoto(null);
        WebView.setWebContentsDebuggingEnabled(false);
        ((android.view.ViewGroup) lab.getParent()).removeView(lab);
        lab.destroy();
        super.onDestroy();
    }
}
