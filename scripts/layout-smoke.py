"""瀏覽器整合測試；請先在遊戲目錄啟動 localhost:8082。"""

import base64
import json
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
    browser = BrowserClient(
        next(p["webSocketDebuggerUrl"] for p in pages if p["type"] == "page")
    )
    browser.send("Runtime.enable")
    browser.send("Page.enable")
    browser.send(
        "Emulation.setDeviceMetricsOverride",
        {"width": 1440, "height": 1100, "deviceScaleFactor": 1, "mobile": False},
    )
    browser.send(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "window.requestAnimationFrame=()=>0;"},
    )
    browser.send("Page.navigate", {"url": "http://127.0.0.1:8082/"})
    for _ in range(100):
        if browser.evaluate("Boolean(window.SpinArena)"):
            break
        time.sleep(0.1)
    checks = []
    for width, height in [(1440, 900), (1366, 768), (390, 844), (375, 667),
                          (320, 568), (844, 390), (667, 375), (568, 320)]:
        browser.send(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": width,
                "height": height,
                "deviceScaleFactor": 1,
                "mobile": width < 900,
            },
        )
        browser.evaluate(
            "SpinArena.reset();SpinArena.setMode('solo');CombatView.open()"
        )
        time.sleep(0.2)
        browser.evaluate("SpinArena.draw()")
        bounds = browser.evaluate(
            (Path(__file__).parent / "cases" / "layout-bounds.js").read_text()
        )
        assert bounds["details"] and bounds["width"] == width, bounds
        assert bounds["signature"]["top"] >= 0, bounds
        assert bounds["canvas"]["height"] >= 140, bounds
        if width < 900:
            browser.send("Emulation.setTouchEmulationEnabled", {"enabled": True})
            def tap(selector):
                point = browser.evaluate("""((selector) => {
                  const el = document.querySelector(selector);
                  el.scrollIntoView({block:'nearest', inline:'nearest'});
                  const r = el.getBoundingClientRect();
                  const x = r.left + r.width/2, y = r.top + r.height/2;
                  if (r.width < 44 || r.height < 44 || r.bottom > innerHeight + 1 ||
                      r.right > innerWidth + 1 || r.top < 0 || r.left < 0 ||
                      !el.contains(document.elementFromPoint(x,y)))
                    throw Error('Unreachable touch control: ' + selector + ' ' + JSON.stringify(r));
                  return {x,y};
                })(""" + json.dumps(selector) + ")")
                browser.send("Input.dispatchTouchEvent", {
                    "type": "touchStart", "touchPoints": [point]})
                browser.send("Input.dispatchTouchEvent", {
                    "type": "touchEnd", "touchPoints": []})

            for mode in ["solo", "local"]:
                browser.evaluate(f"SpinArena.reset();SpinArena.setMode('{mode}');CombatView.open()")
                tap("#launch")
                tap("#launch")
                if mode == "local":
                    tap("#launch-p2")
                browser.evaluate("SpinArena.simulate(2);updateUI()")
                assert browser.evaluate("SpinArena.game.phase==='battle'")
                assert browser.evaluate("document.getElementById('arena').getBoundingClientRect().height >= 140"), (width, height, mode)
                for side in range(2 if mode == "local" else 1):
                    if mode == "local":
                        tap(f"#combat-p{side+1}")
                    suffix = "-p2" if side else ""
                    for selector in [f"#signature{suffix}"] + [
                        f"#skills{suffix} button:nth-child({i})" for i in range(1, 9)
                    ]:
                        browser.evaluate(f"""(() => {{
                          const actor = SpinArena.game.actors[{side}];
                          actor.mana=100;actor.globalCooldown=0;
                          actor.cooldowns={{}};actor.status={{}};actor.cast=null;
                          actor.pending=null;actor.sequence=null;updateUI();
                        }})()""")
                        tap(selector)
                        assert browser.evaluate(f"SpinArena.game.actors[{side}].mana < 100"), selector
                tap("#pause")
                assert browser.evaluate("SpinArena.game.phase==='paused'")
                tap("#pause")
                assert browser.evaluate("SpinArena.game.phase==='battle'")
                browser.evaluate("document.getElementById('combat-skills').scrollTop=0;SpinArena.draw()")
                shot = browser.send("Page.captureScreenshot", {
                    "format": "png", "captureBeyondViewport": False})
                Path(f"/private/tmp/combat-{width}x{height}-{mode}.png").write_bytes(
                    base64.b64decode(shot["data"]))
            browser.send("Emulation.setTouchEmulationEnabled", {"enabled": False})
        checks.append(f"{width}x{height}: arena visible; skills reachable")
    browser.send(
        "Emulation.setDeviceMetricsOverride",
        {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True},
    )
    browser.evaluate(
        "SpinArena.reset();SpinArena.setMode('local');CombatView.open();document.getElementById('combat-p2').click()"
    )
    assert browser.evaluate(
        "getComputedStyle(document.getElementById('p1-panel')).display==='none' && getComputedStyle(document.getElementById('p2-panel')).display!=='none'"
    )
    browser.evaluate("document.getElementById('combat-details').click()")
    assert browser.evaluate(
        "getComputedStyle(document.querySelector('#skills-p2 button small')).display!=='none'"
    )
    browser.evaluate("SpinArena.reset();SpinArena.setMode('solo');SpinArena.launch()")
    assert browser.evaluate("document.body.classList.contains('combat-focus')")
    assert browser.evaluate("SpinArena.game.phase==='ready' && document.getElementById('launch').textContent.includes('蓄力發射')")
    browser.evaluate("document.getElementById('combat-close').click()")
    assert browser.evaluate("SpinArena.game.phase==='ready' && document.getElementById('launch').textContent.includes('進入戰鬥畫面')")
    browser.evaluate("document.getElementById('launch').click();document.getElementById('launch').click()")
    assert browser.evaluate("SpinArena.game.phase==='charging'")
    browser.evaluate("document.getElementById('combat-close').click()")
    assert browser.evaluate(
        "SpinArena.game.phase==='paused'&&!document.body.classList.contains('combat-focus')&&!!document.querySelector('header .audio-controls')"
    )
    browser.evaluate("SpinArena.pause()")
    assert browser.evaluate("document.body.classList.contains('combat-focus')")
    browser.evaluate("SpinArena.reset()")
    assert browser.evaluate("!document.body.classList.contains('combat-focus')")
    print(checks, flush=True)
    print(
        "PASS: auto focus, exit pauses, resume, reset, player tabs and descriptions",
        flush=True,
    )
    assert not browser.errors, browser.errors

finally:
    chrome.terminate()
    try:
        chrome.wait(timeout=5)
    except subprocess.TimeoutExpired:
        chrome.kill()
    log.close()
