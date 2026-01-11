# SPRITE SYSTEM

## 概要

Webブラウザで動作するFantasy Console（仮想ゲーム機）の一種である。
スプライトが主要の表現手段でFM音源採用前の時代を参考にしてる。
ただし、作りやすく扱いやすいサイズだと思うから、グラフィクス解像度とスプライトサイズはPICO-8を参考にしてる。
仕様を追加する意思があり、固定するつもりはない。

## 仕様

解像度: 128x128
スプライト: 最大256枚, サイズは8x8
タイルマップ: 最大2枚, 8x8のパターンを64x64個敷き詰める
パターン定義: 最大256個, サイズは8x8
パレット: 最大4個, 1個あたり16色定義, インデックス0は色指定に関係なく透明色として扱われる
サウンド: PCGのような4チャネル, ノイズ出力可
入力: ゲームパッド2個(プレイヤー1と2のつもり), プレイヤー1用はキーボードへのフォールバックあり, スティック+4ボタンに対応

## ゲーム開発

ゲームは通常のJavaScriptファイルとして作成する。専用のカートリッジ形式は定義しない。

### HTMLの構成

最低限、canvas要素とスクリプトの読み込みが必要となる。

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My Game</title>
</head>
<body>
  <canvas id="screen"></canvas>
  <script src="sprite-system.js"></script>
  <script src="game.js"></script>
</body>
</html>
```

### ゲームスクリプト

```javascript
// game.js
const ss = window.sprite_system;

ss.onReady = function() {
  // データ設定・初期化
};

ss.onUpdate = function(deltaTime) {
  // ゲームロジック
};
```
