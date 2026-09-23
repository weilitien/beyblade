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
    assert browser.evaluate("SoundFX.enabled && SoundFX.state === 'uninitialized'")
    browser.send(
        "Runtime.evaluate",
        {
            "expression": 'document.body.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true}))',
            "userGesture": True,
        },
    )
    for _ in range(40):
        if browser.evaluate('SoundFX.state==="running"'):
            break
        time.sleep(0.1)
    assert browser.evaluate('SoundFX.enabled&&SoundFX.state==="running"')
    browser.evaluate('SoundFX.play("hit",{damage:95,x:-2})')
    time.sleep(0.08)
    power = browser.evaluate(
        "(()=>{const a=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));})()"
    )
    print("Audio waveform peak:", power, flush=True)
    assert power > 0.00001
    checks = browser.evaluate(
        (Path(__file__).parent / "cases" / "audio-smoke-1.js").read_text()
    )
    print(checks, flush=True)
    assert checks["signatures"] == 15 and checks["voices"] == 0
    browser.evaluate('SoundFX.play("skill",{id:"signature",character:"zhugeliang"})')
    time.sleep(1.3)
    assert browser.evaluate("SoundFX.activeVoices") == 0
    # 結算段落需要能正常播完，也必須能立即被靜音中止。
    for outcome in ["win", "lose"]:
        browser.evaluate(f"SoundFX.play('{outcome}')")
        time.sleep(0.10)
        assert browser.evaluate("SoundFX.activeVoices > 0")
        time.sleep(1.05)
        tail = browser.evaluate(
            "(()=>{const samples=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(samples);return Math.max(...samples.map(Math.abs));})()"
        )
        assert tail > 0.00001, (outcome, "Missing musical tail")
        time.sleep(1.4)
        assert browser.evaluate("SoundFX.activeVoices === 0")
    browser.evaluate("SoundFX.play('win')")
    browser.evaluate('document.getElementById("sound").click()')
    time.sleep(0.1)
    assert browser.evaluate("!SoundFX.enabled&&SoundFX.activeVoices===0")
    assert (
        browser.evaluate(
            'document.getElementById("sound").getAttribute("aria-pressed")'
        )
        == "false"
    )
    print(
        "PASS: audio output, 8 common skills, 15 signatures, cleanup, volume and mute",
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
