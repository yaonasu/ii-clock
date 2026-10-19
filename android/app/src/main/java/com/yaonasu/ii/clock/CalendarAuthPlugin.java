package com.yaonasu.ii.clock;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

@CapacitorPlugin(name = "CalendarAuth")
public class CalendarAuthPlugin extends Plugin {
    private PluginCall pendingCall;
    private static final Scope CALENDAR_SCOPE = new Scope("https://www.googleapis.com/auth/calendar.events.readonly");
    private AuthorizationClient client() { return Identity.getAuthorizationClient(getContext()); }

    @PluginMethod
    public void authorize(PluginCall call) {
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(CALENDAR_SCOPE)).build();
        client().authorize(request).addOnSuccessListener(result -> {
            if (result.hasResolution()) {
                try {
                    pendingCall = call;
                    getActivity().startIntentSenderForResult(result.getPendingIntent().getIntentSender(), 9041, null, 0, 0, 0);
                } catch (IntentSender.SendIntentException e) { call.reject("認証画面を開けません", e); }
            } else { resolveToken(call, result); }
        }).addOnFailureListener(e -> call.reject("Google認証に失敗しました: " + e.getMessage(), e));
    }

    public void handleAuthorizationActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != 9041) return;
        PluginCall call = pendingCall;
        pendingCall = null;
        if (call == null) return;
        if (resultCode != Activity.RESULT_OK) { call.reject("Google認証がキャンセルされました"); return; }
        try { resolveToken(call, client().getAuthorizationResultFromIntent(data)); }
        catch (Exception e) { call.reject("Google認証結果の取得に失敗しました", e); }
    }

    private void resolveToken(PluginCall call, AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null || token.isEmpty()) { call.reject("アクセストークンを取得できませんでした"); return; }
        JSObject response = new JSObject();
        response.put("accessToken", token);
        call.resolve(response);
    }

    @PluginMethod
    public void logout(PluginCall call) {
        client().revokeAccess().addOnCompleteListener(task -> {
            if (task.isSuccessful()) call.resolve();
            else call.reject("Googleの連携解除に失敗しました", task.getException());
        });
    }
}
