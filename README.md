# GRASS v1.4.4 WIND + REALISM — Webアプリ

成功確認済みの v1.4.4 WIND MESH FIX をベースにした静的Webアプリです。

## GitHub Pagesで公開

1. GitHubで新しいリポジトリ（例: `grass-wind`）を作成します。
2. このフォルダ内の **4ファイルをリポジトリのルート**にアップロードしてください。
   - `index.html`
   - `main.js`
   - `grass_4m_webxr_wind_realism_v1_4.glb`
   - `README.md`
3. GitHubリポジトリの **Settings → Pages** を開きます。
4. **Build and deployment → Source: Deploy from a branch** にします。
5. **Branch: main / (root)** を選択し **Save** を押します。
6. Pages欄に表示されたURLを開きます（反映には時間がかかる場合があります）。

## 重要

- GitHub Pagesのサイトは、**Publicリポジトリなら原則一般公開**です。非公開にしたい場合は先に公開範囲を確認してください。
- 単に `index.html` をFinderでダブルクリックするだけでは、GLBの読み込みができない場合があります。
- Three.js本体はCDN（jsDelivr）から読み込むため、使用にはインターネット接続が必要です。
- 初回アクセスでは約16 MBのGLBを読み込みます。スマートフォンではタイル数を1から試してください。
- GLBは4m×4mの静的メッシュです。風は `main.js` のThree.jsシェーダーによる表示効果です。
- 実装はv1.4.4成功版を維持したものですが、この公開用パッケージのGitHub Pages実機動作は未検証です。

## ローカル起動（任意）

```bash
cd /path/to/GRASS_v1_4_4_WEB_APP
python3 -m http.server 8005
```

ブラウザで http://localhost:8005/ を開きます。
