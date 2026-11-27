package cn.masterlab.publicdemo;

import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

final class LabAssets extends WebViewClient {
    static final String HOST = "ai-science-studio.onrender.com";
    static final String HOME = "https://" + HOST + "/";
    private final AssetManager assets;

    LabAssets(AssetManager assets) { this.assets = assets; }

    private static boolean local(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getEncodedAuthority());
    }

    static boolean isLabPage(Uri uri) {
        return local(uri) && ("/".equals(uri.getPath()) || "/index.html".equals(uri.getPath()));
    }

    @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return !isLabPage(Uri.parse(url));
    }

    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!local(uri)) {
            String host = uri.getEncodedAuthority();
            boolean api = "masterlab-harmony-ai-2026.onrender.com".equals(host) ||
                "api.deepseek.com".equals(host) || "api.moonshot.cn".equals(host);
            if (api && !request.isForMainFrame() && "https".equals(uri.getScheme())) return null;
            return missing();
        }
        String path = uri.getPath();
        if (!"GET".equals(request.getMethod()) || path == null || !path.startsWith("/") ||
            path.contains("..") || path.contains("\\") || path.contains("//")) return missing();
        String file = path.equals("/") ? "index.html" : path.substring(1);
        try {
            InputStream stream = assets.open(file, AssetManager.ACCESS_STREAMING);
            String ext = file.substring(file.lastIndexOf('.') + 1);
            String mime;
            switch (ext) {
                case "js": mime = "application/javascript"; break;
                case "json": case "webmanifest": mime = "application/json"; break;
                case "svg": mime = "image/svg+xml"; break;
                case "woff": case "woff2": case "ttf": mime = "font/" + ext; break;
                default: mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
            }
            if (mime == null) mime = "application/octet-stream";
            Map<String,String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            if (file.equals("index.html")) {
                headers.put("Content-Security-Policy", "default-src 'self'; script-src 'self'; " +
                    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
                    "connect-src 'self' blob: https://masterlab-harmony-ai-2026.onrender.com https://api.deepseek.com https://api.moonshot.cn; " +
                    "media-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'");
            }
            String encoding = mime.startsWith("text/") || ext.matches("js|json|webmanifest|svg") ? "UTF-8" : null;
            return new WebResourceResponse(mime, encoding, 200, "OK", headers, stream);
        } catch (IOException absent) {
            return missing();
        }
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null,
            new ByteArrayInputStream(new byte[0]));
    }
}
