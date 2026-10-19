# 茄子置時計 (Nasubi Clock)

茄子の針（時針・分針・秒針）が日本標準時（JST）を刻む、モダンな多機能卓上置時計 Android & Web アプリケーションです。

## 主な機能

- **横固定表示（画面上部が右）**: スマホ・タブレットのスタンド設置に最適な横画面配置（Android設定: `reverseLandscape`）
- **茄子針のアナログ時計**: 茄子のフォルム、光沢、緑のヘタを精巧にSVG描画。秒針付き
- **タイマー機能**: ＋/ー 1分、3分、5分、10分 のワンタップ増減、和音アラーム音
- **Google カレンダー直近予定表示**: OAuth連携による直近1件の予定と残り時間の自動表示
- **最新の通知表示**: タイマー完了やリマインダーを1件表示
- **3分ごとの左右レイアウト自動入れ替え**: 有機EL等の画面焼き付き防止
- **背景カスタマイズ**: カメラでの撮影、写真ファイルの選択、拡大縮小、部分切り出し、ぼかし・暗さフィルター
- **起動中最低輝度 & 画面タップ点灯**: バックグラウンド移行時に輝度を自動復帰
- **画面スリープ防止（Wake Lock）**: 置時計として常時点灯を維持

---

## GitHub Actions での自動 APK ビルド

本リポジトリを GitHub に push すると、`.github/workflows/build-apk.yml` が自動起動し、**GitHub 上で自動的に Android APK (`app-debug.apk`) がコンパイル**されます。

1. GitHub リポジトリを作成し、この zip の内容を push します。
2. GitHub の **「Actions」** タブを開きます。
3. 実行されたワークフローの **Artifacts** から、完成した `nasubi-clock-debug-apk` をワンクリックでダウンロードできます。

---

## ローカルでの開発・ビルド手順

### 1. 依存関係のインストール & Web 起動
```bash
npm install
npm run dev
```

### 2. Android 向けビルド & 同期
```bash
npm run build
npx cap sync android
```

### 3. Android Studio で APK をビルド
```bash
npx cap open android
```
Android Studio が起動したら、上部メニューの `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)` を選択すると APK が生成されます。
（出力先: `android/app/build/outputs/apk/debug/app-debug.apk`）


## APK の Google 認証

Google Calendar 認証にはGoogle Play Servicesと固定署名鍵が必要です。初回設定は `GOOGLE_AUTH_SETUP.md` を参照してください。


### Firebase関連ファイルの整理
Firebase SDK、Firebase設定JSON、旧Google Identity Services読み込みを削除しました。`package-lock.json` と `bun.lock` は旧Firebase依存を含むため除外しています。GitHub Actionsの `npm install` で依存解決されます。Capacitorの生成済みWebアセットも除外しており、ワークフローの `npm run build` と `npx cap sync android` で再生成されます。
