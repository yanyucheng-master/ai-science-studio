package cn.masterlab.publicdemo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.widget.Toast;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;
import org.json.JSONObject;

final class LabFiles {
    private static final int PHOTO = 501;
    private static final int MARKDOWN = 502;
    private static final int URI_ACCESS = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
    private final Activity activity;
    private ValueCallback<Uri[]> picker;
    private Uri capture;
    private String markdown;

    LabFiles(Activity activity) { this.activity = activity; }

    void choose(boolean camera, ValueCallback<Uri[]> reply) {
        if (picker != null) { reply.onReceiveValue(null); return; }
        picker = reply;
        try {
            Intent intent;
            if (camera) {
                capture = PhotoProvider.create(activity);
                intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, capture);
                intent.setClipData(ClipData.newRawUri("Camera", capture));
                intent.addFlags(URI_ACCESS);
            } else {
                intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("image/*").putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/jpeg","image/png","image/webp"});
            }
            activity.startActivityForResult(intent, PHOTO);
        } catch (ActivityNotFoundException | SecurityException | IOException failure) {
            finishPhoto(null);
            toast(camera ? "无法打开系统相机，可改用上传照片。" : "无法打开系统图片选择器。");
        }
    }

    void save(String payload) {
        if (markdown != null) { toast("请先完成当前导出。"); return; }
        try {
            JSONObject item = new JSONObject(payload);
            String name = item.getString("name");
            if (!name.matches("大师实验室-AI对话-[0-9]{8}-[0-9]{4}\\.md")) throw new JSONException("Invalid name");
            markdown = item.getString("text");
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("text/markdown").putExtra(Intent.EXTRA_TITLE, name);
            activity.startActivityForResult(intent, MARKDOWN);
        } catch (JSONException | ActivityNotFoundException | SecurityException failure) {
            markdown = null;
            toast("无法创建对话文件。");
        }
    }

    void onResult(int request, int result, Intent data) {
        Uri selected = data == null ? null : data.getData();
        boolean document = selected != null && "content".equals(selected.getScheme()) &&
            !PhotoProvider.AUTHORITY.equals(selected.getAuthority());
        if (request == PHOTO) {
            Uri photo = capture != null ? capture : (document ? selected : null);
            finishPhoto(result == Activity.RESULT_OK && photo != null ? new Uri[]{photo} : null);
        } else if (request == MARKDOWN) {
            String content = markdown;
            markdown = null;
            if (result != Activity.RESULT_OK || !document) return;
            if (content == null) { toast("请重新导出对话。"); return; }
            new Thread(() -> {
                try (OutputStream out = activity.getContentResolver().openOutputStream(selected, "wt")) {
                    if (out == null) throw new IOException("Cannot write document");
                    out.write(content.getBytes(StandardCharsets.UTF_8));
                } catch (IOException | SecurityException failure) {
                    activity.runOnUiThread(() -> toast("保存失败，请重新选择文件位置。"));
                    return;
                }
                activity.runOnUiThread(() -> toast("已保存对话文件。"));
            }, "markdown-export").start();
        }
    }

    void finishPhoto(Uri[] selected) {
        if (capture != null) activity.revokeUriPermission(capture, URI_ACCESS);
        capture = null;
        ValueCallback<Uri[]> reply = picker;
        picker = null;
        if (reply != null) reply.onReceiveValue(selected);
    }

    private void toast(String message) {
        Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
    }
}
