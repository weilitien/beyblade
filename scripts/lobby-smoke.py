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

    clients = [host_browser, guest_browser]
    for _ in range(2):
        target = host_browser.send("Target.createTarget", {"url": "about:blank"})[
            "targetId"
        ]
        pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
        client = BrowserClient(
            next(p["webSocketDebuggerUrl"] for p in pages if p["id"] == target)
        )
        client.send("Runtime.enable")
        client.send("Page.enable")
        client.send(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": "window.requestAnimationFrame=()=>0;"},
        )
        client.send("Page.navigate", {"url": "http://127.0.0.1:8082/"})
        clients.append(client)
    for client in clients:
        until(client, "Boolean(window.SpinArena)")
        client.evaluate(
            "SpinArena.setMode('online');setInterval(()=>RemoteRoom.tick(performance.now()),50)"
        )
    for index, client in enumerate(clients[:3], 1):
        client.evaluate(f"RemoteRoom.create('{index}')")
        until(
            client,
            "document.getElementById('online-status').textContent.includes('房間已建立')",
            30,
        )
    observer = clients[3]
    observer.evaluate("PublicLobby.refresh()")
    until(
        observer,
        "[...document.querySelectorAll('.public-room')].every(card=>card.dataset.state==='waiting')",
        40,
    )
    assert observer.evaluate("document.querySelectorAll('.public-room').length === 3")
    observer.evaluate("RemoteRoom.create('4')")
    assert observer.evaluate("RemoteRoom.role === null")
    observer.evaluate("RemoteRoom.create('1')")
    until(
        observer,
        "document.getElementById('online-status').textContent.includes('剛被其他玩家建立')",
        30,
    )
    assert observer.evaluate("RemoteRoom.role === null")
    assert host_browser.evaluate("RemoteRoom.role === 'host' && !RemoteRoom.connected")
    print(
        "PASS: exactly three shared rooms; occupied ID collision rejected; probes do not reserve seats",
        flush=True,
    )
    clients[1].evaluate("RemoteRoom.leave()")
    observer.evaluate("PublicLobby.refresh()")
    until(
        observer,
        "document.querySelectorAll('.public-room')[1].dataset.state==='empty'",
        40,
    )
    observer.evaluate("RemoteRoom.create('2')")
    until(
        observer,
        "document.getElementById('online-status').textContent.includes('房間已建立')",
        30,
    )
    print("PASS: released room can be created again", flush=True)
    observer.evaluate("RemoteRoom.leave();RemoteRoom.join('1')")
    until(observer, "RemoteRoom.connected", 30)
    clients[1].evaluate("PublicLobby.refresh()")
    until(
        clients[1],
        "document.querySelectorAll('.public-room')[0].dataset.state==='full'",
        40,
    )
    assert clients[1].evaluate("document.querySelector('[data-room=\"1\"]').disabled")
    print(
        "PASS: occupied rooms show full and cannot be joined from the lobby", flush=True
    )
    observer.send(
        "Emulation.setDeviceMetricsOverride",
        {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True},
    )
    assert observer.evaluate("document.documentElement.scrollWidth <= innerWidth")
    observer.save_screenshot("/private/tmp/public-lobby-mobile.png")
    for client in clients:
        client.evaluate("RemoteRoom.leave();PublicLobby.setActive(false)")
        assert not client.errors, client.errors
    print(
        "PASS: mobile lobby has no horizontal overflow and no browser errors",
        flush=True,
    )
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
