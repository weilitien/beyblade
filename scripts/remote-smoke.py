"""瀏覽器整合測試；請先在遊戲目錄啟動 localhost:8082。"""

import json
import sys
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from browser_support import BrowserClient

profile = tempfile.mkdtemp(prefix="war-arena-chrome-", dir="/private/tmp")
log = open("/private/tmp/war-arena-chrome.log", "w")
chrome = subprocess.Popen(
    [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless",
        "--disable-gpu",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--no-first-run",
        "--disable-background-networking",
        "--remote-debugging-port=0",
        "--user-data-dir=" + profile,
        "about:blank",
    ],
    stdout=log,
    stderr=log,
)
try:
    portfile = Path(profile) / "DevToolsActivePort"
    for _ in range(200):
        if portfile.exists():
            break
        time.sleep(0.1)
    port = int(portfile.read_text().splitlines()[0])
    pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
    host_browser = BrowserClient(
        next(p["webSocketDebuggerUrl"] for p in pages if p["type"] == "page")
    )
    host_browser.send("Runtime.enable")
    host_browser.send("Page.enable")
    host_browser.send(
        "Emulation.setDeviceMetricsOverride",
        {"width": 1440, "height": 1100, "deviceScaleFactor": 1, "mobile": False},
    )
    host_browser.send(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "window.requestAnimationFrame=()=>0;"},
    )
    host_browser.send("Page.navigate", {"url": "http://127.0.0.1:8082/"})
    target = host_browser.send("Target.createTarget", {"url": "about:blank"})[
        "targetId"
    ]
    pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
    guest_browser = BrowserClient(
        next(p["webSocketDebuggerUrl"] for p in pages if p["id"] == target)
    )
    guest_browser.send("Runtime.enable")
    guest_browser.send("Page.enable")
    guest_browser.send(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "window.requestAnimationFrame=()=>0;"},
    )
    guest_browser.send("Page.navigate", {"url": "http://127.0.0.1:8082/"})

    def until(client, expr, seconds=15):
        start = time.time()
        while time.time() - start < seconds:
            r = client.evaluate(expr)
            if r:
                return r
            time.sleep(0.1)
        raise Exception(
            "Timed out "
            + expr
            + " "
            + str(
                client.evaluate('document.getElementById("online-status")?.textContent')
            )
        )

    for client in [host_browser, guest_browser]:
        until(client, "Boolean(window.SpinArena)")
        client.evaluate(
            "window.heard=[];const originalPlay=SoundFX.play;SoundFX.play=(kind,data)=>{heard.push(kind);originalPlay(kind,data)}"
        )
        client.evaluate(
            'SpinArena.setMode("online");setInterval(()=>RemoteRoom.tick(performance.now()),50)'
        )
    until(host_browser, "!document.querySelector('[data-room=\"1\"]').disabled", 30)
    host_browser.evaluate("document.querySelector('[data-room=\"1\"]').click()")
    until(
        host_browser,
        'document.getElementById("online-status").textContent.includes("房間已建立")',
        30,
    )
    code = host_browser.evaluate("RemoteRoom.code")
    print("ROOM CREATED", flush=True)
    guest_browser.evaluate("PublicLobby.refresh()")
    until(
        guest_browser,
        "document.querySelector('[data-room=\"1\"]').textContent.includes('加入對戰')",
        30,
    )
    guest_browser.evaluate("document.querySelector('[data-room=\"1\"]').click()")
    until(host_browser, "RemoteRoom.connected", 30)
    until(guest_browser, "RemoteRoom.connected", 30)
    time.sleep(0.4)
    print("REAL WEBRTC CONNECTED", flush=True)
    host_browser.evaluate('SpinArena.select("huangzhong")')
    until(guest_browser, 'SpinArena.game.actors[0].id==="huangzhong"')
    guest_browser.evaluate(
        'document.getElementById("enemy-select").value="zhaoyun";document.getElementById("enemy-select").dispatchEvent(new Event("change"))'
    )
    until(host_browser, 'SpinArena.game.actors[1].id==="zhaoyun"')
    time.sleep(0.2)
    assert guest_browser.evaluate("SpinArena.game.actors[0].id") == "huangzhong"
    # One player's readiness cannot launch a round; cancellation and selection reset it.
    host_browser.evaluate("document.getElementById('room-ready').click()")
    until(guest_browser, "captureNetwork().playerReady[0] === true")
    assert host_browser.evaluate("SpinArena.game.phase === 'ready'")
    host_browser.evaluate("document.getElementById('room-ready').click()")
    until(guest_browser, "captureNetwork().playerReady.every(value=>!value)")
    guest_browser.evaluate("document.getElementById('room-ready').click()")
    until(host_browser, "captureNetwork().playerReady[1] === true")
    host_browser.evaluate("SpinArena.select('huangzhong')")
    until(guest_browser, "captureNetwork().playerReady.every(value=>!value)")
    guest_browser.evaluate("RemoteRoom.command('ready',{revision:-1,value:true})")
    time.sleep(0.2)
    assert host_browser.evaluate("captureNetwork().playerReady.every(value=>!value)")
    host_browser.evaluate("document.getElementById('room-ready').click()")
    until(guest_browser, "captureNetwork().playerReady[0] === true")
    guest_browser.evaluate("document.getElementById('room-ready').click()")
    until(host_browser, "SpinArena.game.phase === 'charging'")
    until(guest_browser, "SpinArena.game.phase === 'charging'")
    print(
        "PASS: both players must ready; cancellation, selection reset and stale readiness are safe",
        flush=True,
    )
    host_browser.evaluate("SpinArena.game.charge=.81;SpinArena.launch()")
    time.sleep(0.2)
    assert guest_browser.evaluate("SpinArena.game.phase") == "charging"
    guest_browser.evaluate("SpinArena.game.charge=.81;SpinArena.launch()")
    until(host_browser, 'SpinArena.game.phase==="countdown"')
    assert host_browser.evaluate("captureNetwork().launchQualities[1]") == 1
    host_browser.evaluate("for(let i=0;i<181;i++)SpinArena.simulate(1/120)")
    until(guest_browser, 'SpinArena.game.phase==="battle"')
    assert not host_browser.evaluate("SpinArena.game.aiEnabled")
    assert host_browser.evaluate("document.body.classList.contains('combat-focus')")
    assert guest_browser.evaluate(
        "document.body.classList.contains('combat-focus') && getComputedStyle(document.getElementById('p1-panel')).display==='none' && getComputedStyle(document.getElementById('p2-panel')).display!=='none'"
    )
    guest_browser.evaluate(
        'window.dispatchEvent(new KeyboardEvent("keydown",{code:"Digit5"}))'
    )
    until(host_browser, 'SpinArena.game.has(SpinArena.game.actors[1],"wall")')
    assert not host_browser.evaluate(
        'SpinArena.game.has(SpinArena.game.actors[0],"wall")'
    )
    print("P2 INPUT ROUTED TO HOST", flush=True)
    host_browser.evaluate("for(let i=0;i<121;i++)SpinArena.simulate(1/120)")
    time.sleep(0.2)
    guest_browser.evaluate(
        'window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyQ"}))'
    )
    until(host_browser, 'SpinArena.game.has(SpinArena.game.actors[1],"evade")')
    time.sleep(0.2)
    assert host_browser.evaluate(
        "SpinArena.game.actors[1].mana"
    ) == guest_browser.evaluate("SpinArena.game.actors[1].mana")
    guest_browser.evaluate('document.getElementById("pause").click()')
    until(host_browser, 'SpinArena.game.phase==="paused"')
    until(guest_browser, 'SpinArena.game.phase==="paused"')
    guest_browser.evaluate('document.getElementById("pause").click()')
    until(host_browser, 'SpinArena.game.phase==="battle"')
    time.sleep(0.2)
    guest_browser.evaluate('RemoteRoom.command("skill",{revision:-1,value:"storm"})')
    time.sleep(0.2)
    assert not host_browser.evaluate(
        'SpinArena.game.has(SpinArena.game.actors[1],"storm")'
    )
    host_browser.evaluate("SpinArena.useSkill('signature');for(let i=0;i<125;i++){SpinArena.game.actors.forEach((a,j)=>{a.x=j?2:-2;a.z=0;a.vx=0;a.vz=0});SpinArena.simulate(1/120)}")
    until(guest_browser, "captureNetwork().signatureEffects.some(e=>e.id==='huangzhong' && e.phase==='release')")
    assert guest_browser.evaluate("captureNetwork().signatureEffects.length <= 16")
    print("PASS: signature release visuals synchronized to guest",flush=True)
    host_browser.evaluate("SpinArena.draw()")
    guest_browser.evaluate("SpinArena.draw()")
    host_browser.save_screenshot("/private/tmp/remote-host.png")
    guest_browser.save_screenshot("/private/tmp/remote-guest.png")
    assert guest_browser.evaluate(
        'heard.includes("charge")&&heard.includes("launch")&&heard.includes("skill")'
    ), "Guest receives sounds independently of host mute"
    time.sleep(0.3)
    heard = guest_browser.evaluate("heard.length")
    time.sleep(0.3)
    assert (
        guest_browser.evaluate("heard.length") == heard
    ), "Repeated snapshots must not replay sounds"
    print("PASS: remote sound events delivered once", flush=True)
    # 同一個結算事件，兩位玩家應聽到各自的勝利／戰敗音效。
    for loser in [1, 0]:
        host_browser.evaluate(
            f"SpinArena.game.actors[{loser}].hp=0;SpinArena.simulate(1/120)"
        )
        until(guest_browser, "SpinArena.game.phase === 'result'")
        assert guest_browser.evaluate("document.getElementById('message-title').textContent.includes('生命歸零')")
        assert guest_browser.evaluate("document.getElementById('message-eyebrow').textContent") == host_browser.evaluate("document.getElementById('message-eyebrow').textContent")
        assert host_browser.evaluate(
            "captureNetwork().playerReady.every(value=>!value)"
        )
        assert host_browser.evaluate("heard.at(-1)") == (
            "win" if loser == 1 else "lose"
        )
        assert guest_browser.evaluate("heard.at(-1)") == (
            "lose" if loser == 1 else "win"
        )
        sound_count = guest_browser.evaluate("heard.length")
        time.sleep(0.2)
        assert guest_browser.evaluate("heard.length") == sound_count
        assert guest_browser.evaluate("document.getElementById('result-reselect').disabled")
        assert host_browser.evaluate("!document.getElementById('result-reselect').disabled")
        host_browser.evaluate("document.getElementById('result-rematch').click()")
        until(
            guest_browser,
            "SpinArena.game.phase === 'result' && captureNetwork().playerReady[0]",
        )
        assert host_browser.evaluate("document.getElementById('result-rematch').disabled")
        guest_browser.evaluate("document.getElementById('result-rematch').click()")
        until(host_browser, "SpinArena.game.phase === 'charging'")
        host_browser.evaluate("SpinArena.game.charge=.81;SpinArena.launch()")
        until(guest_browser, "SpinArena.game.phase === 'charging'")
        guest_browser.evaluate("SpinArena.game.charge=.81;SpinArena.launch()")
        until(host_browser, "SpinArena.game.phase === 'countdown'")
        host_browser.evaluate("for(let i=0;i<181;i++)SpinArena.simulate(1/120)")
        until(guest_browser, "SpinArena.game.phase === 'battle'")
    print("PASS: each player hears the correct ending exactly once", flush=True)

    if '--fire' in sys.argv:
        host_browser.evaluate("SpinArena.reset();SpinArena.select('luxun');SpinArena.setEnemy('luxun');SpinArena.game.start(.8,.8);SpinArena.game.aiEnabled=false;updateUI()")
        until(guest_browser, "SpinArena.game.phase==='battle' && SpinArena.tops.every(a=>a.id==='luxun')")
        measurements = []
        for count in [0, 14, 40]:
            host_browser.evaluate(f"""(() => {{
              const g=SpinArena.game;
              g.actors.forEach(a=>a.status.fireTrail=6);
              g.hazards=Array.from({{length:{count}}},(_,i)=>({{owner:g.actors[i%2],kind:'trail',x:Math.cos(i)*2,z:Math.sin(i)*2,radius:.55,left:1.5,tick:0}}));
              clearInterval(window.fireStamp);
              window.fireStamp=setInterval(()=>g.quality=Date.now(),50);
            }})()""")
            until(guest_browser, f"SpinArena.game.hazards.length==={count}")
            guest_browser.evaluate("""window.fireAges=[];window.fireGaps=[];window.fireLast=0;window.fireArrival=0;
              window.firePoll=setInterval(()=>{const stamp=SpinArena.game.quality;
                if(stamp>1e12 && stamp!==fireLast){const now=Date.now();fireAges.push(now-stamp);
                  if(fireArrival)fireGaps.push(now-fireArrival);fireArrival=now;fireLast=stamp;}},10)""")
            time.sleep(5)
            result=guest_browser.evaluate("""(() => {
              clearInterval(firePoll);
              const summary=a=>{a.sort((x,y)=>x-y);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)}};
              const ownership=SpinArena.game.hazards.map(f=>SignatureFX.hazardStyle(f).side);
              return {ageMs:summary(fireAges),arrivalGapMs:summary(fireGaps),ownership,connected:RemoteRoom.connected};
            })()""")
            host_browser.evaluate("clearInterval(fireStamp)")
            assert result['connected'] and result['ageMs']['samples'] >= 40, result
            assert result['ownership']==[i%2 for i in range(count)], result
            result['hazards']=count
            result['snapshotBytes']=host_browser.evaluate("new TextEncoder().encode(JSON.stringify(captureNetwork())).length")
            measurements.append(result)
        (Path(__file__).parent.parent/'reports'/'fire-remote.json').write_text(json.dumps({
            'note':'Two local Chrome tabs over actual WebRTC; synthetic stable double-Lu-Xun hazards; 5 seconds each, 50ms sender stamps, 10ms guest polling. Age includes capture cadence and polling, not Internet latency.',
            'measurements':measurements},indent=2)+'\n')
        print('PASS: double Lu Xun stress snapshots, ownership, and arrival measurements', measurements, flush=True)

    guest_browser.evaluate(
        (Path(__file__).parent / "cases" / "remote-smoke-1.js").read_text()
    )
    until(guest_browser, "window.thirdRejected", 20)
    assert host_browser.evaluate("RemoteRoom.connected")
    guest_browser.evaluate("thirdPeer.destroy()")
    guest_browser.evaluate('document.getElementById("room-leave").click()')
    until(host_browser, "!RemoteRoom.connected")
    assert host_browser.evaluate("SpinArena.game.phase") == "paused"
    print(
        "PASS: selection, two launch locks, P2 common/signature skills, matching mana, shared pause/resume, disconnect stop",
        flush=True,
    )
    assert not host_browser.errors, host_browser.errors
    assert not guest_browser.errors, guest_browser.errors
finally:
    print("HOST ERRORS", host_browser.errors, flush=True)
    if "guest_browser" in locals():
        print("GUEST ERRORS", guest_browser.errors, flush=True)
    chrome.terminate()
    try:
        chrome.wait(timeout=5)
    except subprocess.TimeoutExpired:
        chrome.kill()
    log.close()
