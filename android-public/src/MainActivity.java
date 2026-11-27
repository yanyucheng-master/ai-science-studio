package cn.masterlab.publicdemo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.TextView;
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
    private static final String SITE = "https://ai-science-studio.onrender.com/";
    private static final String RELEASES = SITE + "android/";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private long lastCheck = -1;
    private int installedCode;
    private Uri availableApk;
    private Button check;
    private Button download;
    private TextView status;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.main);
        View root = findViewById(R.id.root);
        if (Build.VERSION.SDK_INT >= 35) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            installedCode = info.versionCode;
            ((TextView) findViewById(R.id.installed)).setText("已安装版本 " + info.versionName);
        } catch (PackageManager.NameNotFoundException impossible) {
            throw new IllegalStateException(impossible);
        }
        status = findViewById(R.id.status);
        check = findViewById(R.id.check);
        download = findViewById(R.id.download);
        findViewById(R.id.open_lab).setOnClickListener(v -> openBrowser(Uri.parse(SITE), true));
        check.setOnClickListener(v -> checkRelease());
        download.setOnClickListener(v -> {
            if (availableApk != null) openBrowser(availableApk, false);
        });
    }

    @Override protected void onResume() {
        super.onResume();
        if (lastCheck < 0 || SystemClock.elapsedRealtime() - lastCheck >= 300_000) checkRelease();
    }

    private void openBrowser(Uri url, boolean customTab) {
        Intent intent = new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE);
        if (customTab) {
            // The standard null session requests a browser Custom Tab without binding a service.
            Bundle extras = new Bundle();
            extras.putBinder("android.support.customtabs.extra.SESSION", null);
            extras.putInt("android.support.customtabs.extra.TOOLBAR_COLOR", 0xffeaf0fa);
            intent.putExtras(extras);
        }
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException noBrowser) {
            Toast.makeText(this, "请先启用一个可打开 HTTPS 链接的浏览器。", Toast.LENGTH_LONG).show();
        }
    }

    private void checkRelease() {
        if (!check.isEnabled()) return;
        check.setEnabled(false);
        status.setText("正在检查公网安装包…");
        lastCheck = SystemClock.elapsedRealtime();
        worker.execute(() -> {
            try {
                JSONObject release = readRelease();
                int code = release.getInt("versionCode");
                String name = release.getString("versionName");
                String filename = "master-lab-" + code + ".apk";
                if (code <= 0 || !name.matches("[0-9]+(\\.[0-9]+){2}") ||
                    !release.getString("apk").equals(filename) ||
                    !release.getString("packageName").equals(getPackageName())) {
                    throw new IOException("Invalid release");
                }
                runOnUiThread(() -> {
                    if (isDestroyed() || isFinishing()) return;
                    boolean newer = code > installedCode;
                    availableApk = newer ? Uri.parse(RELEASES + filename) : null;
                    download.setVisibility(newer ? View.VISIBLE : View.GONE);
                    status.setText(newer ? "发现新版 " + name + "。下载后，点开 APK 确认更新。"
                                          : "安装包已是最新版本。网页内容随公网更新。");
                    check.setEnabled(true);
                });
            } catch (IOException | JSONException failure) {
                runOnUiThread(() -> {
                    if (isDestroyed() || isFinishing()) return;
                    status.setText("无法获取版本信息，请检查网络后重试。");
                    check.setEnabled(true);
                });
            }
        });
    }

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
        super.onDestroy();
    }
}
