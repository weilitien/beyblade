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
    result = browser.evaluate(
        (Path(__file__).parent / "cases" / "health-smoke-1.js").read_text()
    )
    print(result, flush=True)
    assert not browser.errors, browser.errors

finally:
    chrome.terminate()
    try:
        chrome.wait(timeout=5)
    except subprocess.TimeoutExpired:
        chrome.kill()
    log.close()
