"""精簡的 Chrome DevTools 用戶端，供瀏覽器整合測試共用。

透過 WebSocket 傳送指令、執行 JavaScript，並收集瀏覽器例外。
只使用 Python 標準函式庫，不需要 Selenium 或 Playwright。
"""

import base64
import json
import os
import socket
import struct
from pathlib import Path


class BrowserClient:
    def __init__(self, url):
        from urllib.parse import urlparse

        address = urlparse(url)
        self.socket = socket.create_connection(
            (address.hostname, address.port), timeout=15
        )
        self.socket.settimeout(20)
        self.buffer = b""
        self.request_number = 0
        self.errors = []
        key = base64.b64encode(os.urandom(16)).decode()
        self.socket.sendall(
            (
                f"GET {address.path} HTTP/1.1\r\nHost: {address.hostname}:{address.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
            ).encode()
        )
        data = b""
        while b"\r\n\r\n" not in data:
            data += self.socket.recv(4096)
        head, self.buffer = data.split(b"\r\n\r\n", 1)
        assert b"101" in head, head

    def read(self, n):
        while len(self.buffer) < n:
            self.buffer += self.socket.recv(max(4096, n - len(self.buffer)))
        out, self.buffer = self.buffer[:n], self.buffer[n:]
        return out

    def receive(self):
        a, b = self.read(2)
        n = b & 127
        if n == 126:
            n = struct.unpack("!H", self.read(2))[0]
        if n == 127:
            n = struct.unpack("!Q", self.read(8))[0]
        mask = self.read(4) if b & 128 else None
        data = self.read(n)
        if mask:
            data = bytes(v ^ mask[i % 4] for i, v in enumerate(data))
        return json.loads(data)

    def send(self, method, params=None):
        self.request_number += 1
        request_id = self.request_number
        data = json.dumps(
            {"id": request_id, "method": method, "params": params or {}}
        ).encode()
        n = len(data)
        mask = os.urandom(4)
        header = (
            bytes([0x81, 0x80 | n])
            if n < 126
            else (
                bytes([0x81, 0x80 | 126]) + struct.pack("!H", n)
                if n < 65536
                else bytes([0x81, 0x80 | 127]) + struct.pack("!Q", n)
            )
        )
        self.socket.sendall(
            header + mask + bytes(v ^ mask[i % 4] for i, v in enumerate(data))
        )
        while True:
            result = self.receive()
            if result.get("method") == "Runtime.exceptionThrown":
                self.errors.append(result["params"])
            if result.get("id") == request_id:
                if "error" in result:
                    raise RuntimeError(result["error"])
                return result.get("result", {})

    def evaluate(self, expression):
        response = self.send(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        if "exceptionDetails" in response:
            raise RuntimeError(response["exceptionDetails"])
        return response.get("result", {}).get("value")

    def save_screenshot(self, path):
        response = self.send(
            "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True}
        )
        Path(path).write_bytes(base64.b64decode(response["data"]))
