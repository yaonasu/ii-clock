# Android APK Google カレンダー認証設定

GoogleログインはWebViewのGIS/Firebase popupを使わず、Google Play Services AuthorizationClientで Calendar events.readonly の権限を取得します。Web版でのログインは対象外です。

## 1. 固定署名鍵を準備（開発者のみ）

ローカルで一度だけ以下を実行してください（**秘密鍵はGitに登録しない**）。

```bash
keytool -genkeypair -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
base64 -w0 debug.keystore  # macOSでは base64 < debug.keystore | tr -d '\n'
```

出力文字列をGitHubリポジトリの Settings → Secrets and variables → Actions → New repository secret に `DEBUG_KEYSTORE_BASE64` として登録してください。ワークフローは毎回この鍵でdebug APKを署名します。公開リポジトリに秘密鍵をコミットしないでください。

## 2. Google Cloud Console

- Google Calendar APIを有効化する。
- OAuth同意画面を設定する。`https://www.googleapis.com/auth/calendar.events.readonly` をスコープに追加する。
- OAuthクライアントを **Android** として作成する。
- パッケージ名: `com.yaonasu.ii.clock`
- SHA-1: 上記keystoreに対して `keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android` の `SHA1:` の値。
- テストモードの場合は、利用するGoogleアカウントをテストユーザーに登録する。一般利用者向け公開にはGoogle側のOAuthアプリ検証が必要になる場合があります。

## 3. GitHub Actions

GitHub ActionsのBuild Android APKを実行し、ログに表示されるSHA1がCloud Consoleの登録値と一致することを確認してください。APKを実機にインストールしてGoogleログインを試します。

## 制約

Androidの実機動作とGoogle Cloud側の登録は、このZIP生成環境では実行できません。カレンダー読み取り以外のOAuth権限は要求しません。署名鍵を変更するとSHA-1登録も更新が必要です。
