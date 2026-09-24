# 從哪裡開始讀程式

## 遊戲本體

| 想修改的內容 | 檔案 | 閱讀起點 |
| --- | --- | --- |
| 網頁內容與按鈕 | `index.html` | 依中文區塊註解找頁首、房間、戰場或彈出視窗 |
| 同畫面戰鬥操作 | `combat-view.js`、`combat-view.css` | `open()`、`close()` 與響應式技能列 |
| 介面排版與顏色 | `war-style.css` | 覆寫基礎 `style.css` 的三國主題 |
| 武將與技能數值 | `war-data.js` | `characters`、`common` |
| 傷害、技能與勝負 | `war-engine.js` | `WarBattle.hit()`、`use()`、`checkEnd()` |
| 畫面與玩家操作 | `game.js` | `updateUI()`、`processEvents()`、`simulate()` |
| 陀螺幾何與徽章 | `top-art.js`、`general-art.js` | 共用繪製器與各武將外觀資料 |
| 戰場繪製 | `war-visuals.js` | `draw()`、`topMesh()` |
| 音效設計 | `sound-fx.js` | `impact()`、`slash()`、`shield()`、`signature()` |
| 公開大廳 | `public-lobby.js` | 三間房的狀態查詢、加入入口與自動更新 |
| 遠端房間 | `remote-room.js` | 房間生命週期、連線與封包 |

一個操作的路徑：按鈕或鍵盤 → `game.js` → `WarBattle.use()` → 引擎產生事件 → `processEvents()` → 畫面與音效。遠端訪客的操作先送房主，再由房主計算並同步結果。

## Python 測試

`audio-smoke.py`、`health-smoke.py`、`remote-smoke.py` 分別測試音效、血量結算與遠端對戰。`lobby-smoke.py` 測試三間公開房的上限與釋出。共同的瀏覽器通訊程式集中在 `scripts/browser_support.py`。

較長的 JavaScript 測試情境放在 `scripts/cases/`，Python 負責啟動瀏覽器與斷言；不再把整段情境擠在單行字串中。

## 排版約定

HTML、CSS、JavaScript 採 2 格縮排（Prettier）；Python 採 4 格縮排（Black）。不要手動壓縮原始碼；第三方套件 `vendor/` 保留原始發行格式。

```sh
npx prettier@3.6.2 --write .
python3 -m black scripts
node scripts/check.cjs
```

格式設定在 `.prettierrc.json`。本機測試前，在遊戲根目錄啟動 `python3 -m http.server 8082`。
