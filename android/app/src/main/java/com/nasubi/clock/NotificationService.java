package com.nasubi.clock;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class NotificationService extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;
        Notification notification = sbn.getNotification();
        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleChar = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
        String title = titleChar != null ? titleChar.toString() : "";
        String text = textChar != null ? textChar.toString() : "";
        String pkg = sbn.getPackageName() != null ? sbn.getPackageName() : "";

        if (title.isEmpty() && text.isEmpty()) return;

        Intent intent = new Intent("com.nasubi.clock.NOTIFICATION_RECEIVED");
        intent.putExtra("package", pkg);
        intent.putExtra("title", title);
        intent.putExtra("text", text);
        intent.putExtra("time", System.currentTimeMillis());
        sendBroadcast(intent);
    }
}
