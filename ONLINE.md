# 遠端雙人對打

遊戲網址（部署完成後）：https://weilitien.github.io/beyblade/

1. 房主選「遠端雙人 · 邀請朋友」，按「建立房間 · P1」。
2. 把「複製邀請連結」取得的網址傳給朋友，保持房主頁面開啟。
3. 朋友開啟連結後，按「加入房間 · P2」。亦可輸入 10 碼房間代碼。
4. P1 用角色卡選將，P2 用「P2 武將」選單選將。兩邊都用空白鍵發射、1–8 通用技、Q 專屬技、P 暫停。也能按自己的技能按鈕。
5. 任一方開始蓄力後，雙方各自鎖定發射時機。兩人都鎖定才開戰。
6. 房主可「重新選將」再戰；離開房間或連線失效會停止對戰，不會由 AI 接手。

## 網路與同步

網站可完全放在 GitHub Pages。PeerJS 1.5.5 隨附於 `vendor/`（MIT 授權）；預設由 PeerJS 公用 PeerServer 交換連線資訊，之後透過 WebRTC DataChannel 傳送操作與狀態。房主以既有引擎計算戰鬥、每秒最多傳送 20 次快照；訪客只送操作、不自行推算傷害。訪客發射使用當下畫面上的蓄力值，避免網路往返時間改變發射品質。操作包含遞增序號與本場版本，拒絕重複或跨場的舊操作。

這是朋友對戰原型，房主的瀏覽器是權威端；沒有競技遊戲的獨立防作弊伺服器。房主切換分頁會暫停對戰。斷線後需重新建立／加入房間。

公用房間服務或網路限制可能導致連線失敗。對稱 NAT、企業防火牆等環境可能需要 TURN 中繼；目前沒有配置自有 TURN 服務，也不保證所有網路均可互通。如需穩定商用部署，可在 `network-config.js` 設定自有 PeerServer 及短效 TURN 認證；不要把長效密碼提交到公開儲存庫。

## 部署

獨立儲存庫以此資料夾內容作為根目錄。`.github/workflows/pages.yml` 應採用 `deploy/pages.yml` 的內容。GitHub 儲存庫 Settings → Pages → Source 選 **GitHub Actions**；推送 main 後執行 74 項引擎檢查，再發布網站。不需 npm 安裝或後端主機。

本機：在遊戲根目錄執行 `python3 -m http.server 8082`，開啟 http://localhost:8082/。遠端分享時使用部署後的 HTTPS 網址，localhost 連結僅供本機驗證。

`node scripts/check.cjs`：引擎回歸及語法檢查。
`python3 scripts/remote-smoke.py`：macOS Chrome 的真實雙分頁 WebRTC 整合測試，需要本機 8082 伺服器、可存取公用 PeerServer 的網路，以及 `/private/tmp` 寫入權限。測試包含選將、雙方發射、P2 出招、魔法一致、雙方暫停／繼續與斷線停止。

參考：[PeerJS 官方入門](https://peerjs.com/client/getting-started)、[GitHub Pages 官方部署文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
