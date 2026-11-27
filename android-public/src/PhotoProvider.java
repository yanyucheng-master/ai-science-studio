package cn.masterlab.publicdemo;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.UUID;

public final class PhotoProvider extends ContentProvider {
    static final String AUTHORITY = "cn.masterlab.publicdemo.photos";

    static Uri create(Context context) throws IOException {
        File dir = new File(context.getCacheDir(), "captures");
        if (!dir.isDirectory() && !dir.mkdir()) throw new IOException("Camera directory unavailable");
        File[] old = dir.listFiles();
        if (old != null) for (File item : old) {
            if (item.lastModified() < System.currentTimeMillis() - 86400000L) item.delete();
        }
        File photo = new File(dir, UUID.randomUUID() + ".jpg");
        if (!photo.createNewFile()) throw new IOException("Camera output unavailable");
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath(photo.getName()).build();
    }

    private File photo(Uri uri) {
        String name = uri.getLastPathSegment();
        if (!AUTHORITY.equals(uri.getAuthority()) || uri.getPathSegments().size() != 1 ||
            name == null || !name.matches("[0-9a-f-]{36}\\.jpg")) throw new IllegalArgumentException("Unknown photo");
        return new File(new File(getContext().getCacheDir(), "captures"), name);
    }

    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { photo(uri); return "image/jpeg"; }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = photo(uri);
        if (!file.isFile()) throw new FileNotFoundException("Photo expired");
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.parseMode(mode));
    }
    @Override public Cursor query(Uri uri, String[] columns, String selection, String[] args, String order) {
        File file = photo(uri);
        if (columns == null) columns = new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor result = new MatrixCursor(columns);
        MatrixCursor.RowBuilder row = result.newRow();
        for (String column : columns) {
            if (OpenableColumns.DISPLAY_NAME.equals(column)) row.add(file.getName());
            else if (OpenableColumns.SIZE.equals(column)) row.add(file.length());
            else row.add(null);
        }
        return result;
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
}
