package io.github.stravix86.privatepdf;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Shows the bundled web app (assets/) in a WebView, served from
 * https://appassets.androidplatform.net so storage and workers behave like on the web.
 *
 * Bridge (window.NativeApp):
 *   saveBase64(name, mime, data)  - "Save as" dialog for a finished file
 *   shareBase64(name, mime, data) - Android share sheet
 *   ready()                       - the page is ready to receive files opened from other apps
 *
 * PDFs opened with "Open with" or shared to the app are copied to cache/incoming and
 * served at /incoming/ so the page can fetch them without passing large strings around.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/index.html";
    private static final int REQ_PICK_FILE = 1;
    private static final int REQ_SAVE_FILE = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingSave;
    private boolean pageReady = false;
    private final List<JSONObject> pendingOpen = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/incoming/", new WebViewAssetLoader.InternalStoragePathHandler(this, incomingDir()))
                .build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri)); // external links open in the browser
                } catch (ActivityNotFoundException ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                boolean imagesOnly = types.length > 0 && types[0].startsWith("image/") && types.length == 1;
                i.setType(imagesOnly ? "image/*" : "*/*");
                if (!imagesOnly) i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf", "image/*"});
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(i, null), REQ_PICK_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "NativeApp");
        web.loadUrl(START_URL);
        handleIncoming(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIncoming(intent);
    }

    private class Bridge {
        @JavascriptInterface
        public void saveBase64(String name, String mime, String data) {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            runOnUiThread(() -> save(name, mime, bytes));
        }

        @JavascriptInterface
        public void shareBase64(String name, String mime, String data) {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            runOnUiThread(() -> share(name, mime, bytes));
        }

        @JavascriptInterface
        public void ready() {
            runOnUiThread(() -> {
                pageReady = true;
                deliverPending();
            });
        }
    }

    // ---------- files from other apps ----------

    private File incomingDir() {
        File dir = new File(getCacheDir(), "incoming");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private void handleIncoming(Intent intent) {
        if (intent == null) return;
        List<Uri> uris = new ArrayList<>();
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null) {
            uris.add(intent.getData());
        } else if (Intent.ACTION_SEND.equals(action)) {
            Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
        }
        if (uris.isEmpty()) {
            ClipData clip = intent.getClipData();
            if (clip != null && !Intent.ACTION_MAIN.equals(action)) {
                for (int i = 0; i < clip.getItemCount(); i++) if (clip.getItemAt(i).getUri() != null) uris.add(clip.getItemAt(i).getUri());
            }
        }
        if (uris.isEmpty()) return;
        intent.setAction(Intent.ACTION_MAIN); // don't reopen the same files after rotation

        new Thread(() -> {
            List<JSONObject> files = new ArrayList<>();
            File dir = incomingDir();
            for (Uri u : uris) {
                try {
                    String name = displayName(u);
                    String mime = getContentResolver().getType(u);
                    String safe = System.nanoTime() + "-" + name.replaceAll("[^A-Za-z0-9._-]", "_");
                    try (InputStream in = getContentResolver().openInputStream(u);
                         OutputStream out = new FileOutputStream(new File(dir, safe))) {
                        if (in == null) continue;
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    }
                    JSONObject o = new JSONObject();
                    o.put("name", name);
                    o.put("mime", mime == null ? "" : mime);
                    o.put("url", "https://" + HOST + "/incoming/" + safe);
                    files.add(o);
                } catch (Exception e) {
                    runOnUiThread(() -> toast("Couldn't open a file"));
                }
            }
            runOnUiThread(() -> {
                pendingOpen.addAll(files);
                deliverPending();
            });
        }).start();
    }

    private void deliverPending() {
        if (!pageReady || pendingOpen.isEmpty()) return;
        JSONArray arr = new JSONArray();
        for (JSONObject o : pendingOpen) arr.put(o);
        pendingOpen.clear();
        web.evaluateJavascript("window.openNativeUrls && window.openNativeUrls(" + arr + ")", null);
    }

    private String displayName(Uri u) {
        String name = null;
        try (Cursor c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) { }
        if (name == null) name = u.getLastPathSegment();
        return name == null || name.isEmpty() ? "document.pdf" : name;
    }

    // ---------- saving and sharing ----------

    private void save(String name, String mime, byte[] bytes) {
        pendingSave = bytes;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime)
                .putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(i, REQ_SAVE_FILE);
        } catch (ActivityNotFoundException e) {
            pendingSave = null;
            toast("No app available to save files");
        }
    }

    private void share(String name, String mime, byte[] bytes) {
        try {
            File dir = new File(getCacheDir(), "shared");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException();
            File f = new File(dir, name.replaceAll("[^A-Za-z0-9._ -]", "_"));
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            Intent send = new Intent(Intent.ACTION_SEND)
                    .setType(mime)
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(send, null));
        } catch (Exception e) {
            toast("Couldn't share the file");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK_FILE) {
            if (fileCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        ClipData clip = data.getClipData();
                        result = new Uri[clip.getItemCount()];
                        for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
                    } else if (data.getData() != null) {
                        result = new Uri[]{data.getData()};
                    }
                }
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
        } else if (requestCode == REQ_SAVE_FILE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                if (out == null) throw new IllegalStateException();
                out.write(bytes);
                toast("Saved");
            } catch (Exception e) {
                toast("Couldn't save the file");
            }
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Let the page close the editor or a dialog first.
        web.evaluateJavascript("window.handleBack ? window.handleBack() : false", (v) -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
