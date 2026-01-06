# CuraQ Saver - Chrome Extension

[CuraQ](https://curaq.pages.dev) に記事を保存するための公式Chrome拡張機能です。

**CuraQ** は、保存した記事をAIが自動整理し、あなたに最適な記事を毎日配信する知識キュレーションサービスです。

この拡張機能を使うことで、**ログインウォールのある記事**（Medium会員限定記事、Noteプレミアム記事など）も簡単に保存できます。

## 特徴

- **ログインウォール対応**: ブラウザ上で表示されている記事をそのまま保存できるため、サーバー側でfetchできないログインが必要な記事も保存可能
- **本文抽出**: Mozilla Readabilityを使用して記事の主要コンテンツを自動抽出
- **Markdown変換**: HTML→Markdown変換により、CuraQのAI解析に最適化された形式で送信
- **簡単操作**: 右クリックメニューまたは拡張アイコンクリックで即座に保存

## 必要なもの

- [CuraQ](https://curaq.pages.dev) のアカウント（無料）
- Google Chrome ブラウザ

## インストール方法

### Chrome Web Store（準備中）

*現在、Chrome Web Storeへの公開準備中です。*

### 手動インストール

1. このリポジトリをクローンまたはダウンロード
   ```bash
   git clone https://github.com/togishima/curaq-chrome-extension.git
   ```

2. Chromeで `chrome://extensions/` を開く

3. 右上の「デベロッパーモード」をONにする

4. 「パッケージ化されていない拡張機能を読み込む」をクリック

5. ダウンロードしたディレクトリを選択

6. [CuraQ](https://curaq.pages.dev/login) にログインしていることを確認

## 使い方

### 方法1: 右クリックメニュー

1. 保存したい記事を開く
2. ページ上で右クリック
3. 「CuraQに保存」を選択

### 方法2: 拡張アイコン

1. 保存したい記事を開く
2. ブラウザツールバーの拡張アイコンをクリック

### 通知

保存が完了すると、以下のような通知が表示されます：

- **保存完了**: 記事が正常に保存されました
- **既読記事**: この記事は既に読了済みです
- **月間制限**: 今月の記事保存上限に達しました
- **未読上限**: 未読記事が30件に達しています
- **未ログイン**: CuraQにログインしてください

## 技術詳細

### アーキテクチャ

```
[Content Script] ← → [Background Service Worker] ← → [CuraQ API]
      ↓                                                    ↓
  Readability.js                                     /share エンドポイント
  Turndown.js                                        (markdown受付対応)
```

### 処理フロー

1. **ユーザー操作**: 右クリックメニューまたは拡張アイコンをクリック
2. **本文抽出**: Content Scriptが Readability.js で記事の主要コンテンツを抽出
3. **Markdown変換**: Turndown.js で HTML → Markdown 変換
4. **API送信**: Background Service Worker が CuraQ の `/share` エンドポイントに送信
   - `url`: 記事のURL
   - `title`: 記事タイトル
   - `markdown`: Markdown化された本文
5. **AI解析**: CuraQ側で Gemini APIにより要約・タグ・読了時間を自動生成
6. **結果通知**: 保存結果を通知で表示

### 使用ライブラリ

- **Readability.js** (v0.5.0): Mozilla製の本文抽出ライブラリ
- **Turndown.js** (v7.1.3): HTML→Markdown変換ライブラリ

## トラブルシューティング

### 保存できない場合

1. **CuraQにログインしているか確認**
   - 拡張機能は Cookie を使用して認証するため、CuraQ にログイン済みである必要があります
   - ログインしていない場合は通知からログインページが開きます

2. **本文を抽出できない場合**
   - 一部のサイトは Readability が対応していない構造の場合があります
   - その場合は PWA Share Target や手動URL入力で保存してください

3. **CORS エラーが発生する場合**
   - `manifest.json` の `host_permissions` に CuraQ のドメインが含まれているか確認してください

## 開発

### ローカルテスト

1. `background.js` の `CURAQ_API_URL` を `http://localhost:5173/share` に変更
2. CuraQ をローカルで起動 (`pnpm run dev`)
3. 拡張機能をリロード (`chrome://extensions/` で「再読み込み」ボタン）

### デバッグ

- **Background Service Worker**: `chrome://extensions/` → 拡張の「Service Worker」をクリック
- **Content Script**: 記事ページで右クリック → 検証 → Console タブ

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## サポート

問題が発生した場合や機能要望がある場合は、以下の方法でご連絡ください：

- **アプリ内フィードバック**: [https://curaq.pages.dev/feedback](https://curaq.pages.dev/feedback) (推奨)
  - バグ報告、機能要望、その他のご意見を受け付けています
