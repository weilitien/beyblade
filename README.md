# 三國・陀螺爭霸 / SPIN FOR GLORY

15 位武將、專屬陀螺外觀與半即時技能對戰。支援單人挑戰電腦、同機雙人及遠端雙人房間。

**遊戲網址（Pages 部署完成後）：https://weilitien.github.io/beyblade/**

## 遠端對戰

房主選「遠端雙人 · 邀請朋友」→ 建立房間 → 複製邀請連結。朋友開啟連結並按加入房間。兩人各自選將，都用空白鍵發射、1–8 通用技、Q 專屬技、P 暫停。

雙方鎖定發射時機後開戰；房主計算戰鬥並同步給訪客。房主需保持頁面開啟，部分受限網路需要額外 TURN 中繼。

詳見 [連線、測試與部署說明](ONLINE.md)。

## 本機啟動

```sh
python3 -m http.server 8082
```

開啟 http://localhost:8082/。`tests.html` 可執行引擎測試；CI 以 `node scripts/check.cjs` 檢查 74 項規則及 JavaScript 語法。

## 原型範圍

陀螺自動移動碰撞，玩家選擇技能時機。馬超、龐德、夏侯惇、甘寧、孫策採使用者設計文件數值，其餘角色與未指定參數為暫定平衡值。這是 Canvas 投影幾何的瀏覽器原型，非官方 Beyblade 遊戲。

24 秒宣傳片位於 [promo/](promo/)。PeerJS 1.5.5 的授權位於 [vendor/peerjs.LICENSE](vendor/peerjs.LICENSE)。

## 音效

音效預設開啟（音量 70%），首次點擊或按鍵後自動啟用。可聽到加強低頻的金屬撞擊，以及 8 招通用技、15 招武將專屬音型；右上可靜音或調整音量。遠端音效事件同步且不重播。詳見 [音效說明](AUDIO.md)。

## 閱讀與維護程式

程式已依區塊展開排版；Python 共用瀏覽器工具與 JavaScript 測試情境分開。請從 [程式導讀](CODE_GUIDE.md) 找要修改的功能。
