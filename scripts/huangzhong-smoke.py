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
        {
            "source": "const make=AudioContext.prototype.createDynamicsCompressor;AudioContext.prototype.createDynamicsCompressor=function(){const node=make.call(this);window.meter=this.createAnalyser();node.connect(window.meter);return node;}"
        },
    )
    browser.send("Page.navigate", {"url": "http://127.0.0.1:8082/"})
    for _ in range(100):
        if browser.evaluate("Boolean(window.SoundFX&&window.SpinArena)"):
            break
        time.sleep(0.1)
    browser.evaluate("const result=document.createElement('pre');result.id='result';document.body.append(result)")
    browser.evaluate((Path(__file__).parent.parent/'war-tests.js').read_text())
    assert browser.evaluate("testResults.length") == 101
    browser.evaluate("SpinArena.select('huangzhong');SpinArena.draw()")
    assert browser.evaluate("SpinArena.game.actors[0].id === 'huangzhong'")
    browser.evaluate("document.getElementById('result').remove()")
    browser.save_screenshot('/private/tmp/huangzhong-preview.png')
    assert not browser.errors, browser.errors
    print('PASS: 101 engine checks; Huang Zhong selection and rendering',flush=True)
finally:
    chrome.terminate()
    try:
        chrome.wait(timeout=5)
    except subprocess.TimeoutExpired:
        chrome.kill()
    log.close()
