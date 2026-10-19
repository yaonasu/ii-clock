package com.yaonasu.ii.clock;

import android.os.Bundle;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.view.MotionEvent;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    private final Runnable hideBars = this::hideSystemBars;
    private static final long SHOW_DURATION_MS = 10000L;

    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void showBarsTemporarily() {
        uiHandler.removeCallbacks(hideBars);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        uiHandler.postDelayed(hideBars, SHOW_DURATION_MS);
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CalendarAuthPlugin.class);
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }
    @Override public void onResume() {
        super.onResume();
        hideSystemBars();
    }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        if (event.getActionMasked() == MotionEvent.ACTION_DOWN) showBarsTemporarily();
        return super.dispatchTouchEvent(event);
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 9041) {
            CalendarAuthPlugin plugin = (CalendarAuthPlugin) getBridge().getPlugin("CalendarAuth").getInstance();
            plugin.handleAuthorizationActivityResult(requestCode, resultCode, data);
        }
    }
    @Override public void onDestroy() {
        uiHandler.removeCallbacks(hideBars);
        super.onDestroy();
    }
}
