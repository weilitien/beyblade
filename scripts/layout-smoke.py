"""瀏覽器整合測試；請先在遊戲目錄啟動 localhost:8082。"""

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
    for width, height in [(1440, 900), (1366, 768), (390, 844), (375, 667), (844, 390)]:
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
        assert (
            bounds["signature"]["top"] >= 0 and bounds["lastBottom"] <= height
        ), bounds
        assert bounds["canvas"]["height"] >= 140, bounds
        browser.save_screenshot(f"/private/tmp/combat-{width}x{height}.png")
        checks.append(f"{width}x{height}: arena and all 9 skills visible")
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
