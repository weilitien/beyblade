import base64, hashlib, json, os, socket, struct, subprocess, tempfile, time, urllib.request
from pathlib import Path

class CDP:
    def __init__(self, url):
        from urllib.parse import urlparse
        u=urlparse(url); self.s=socket.create_connection((u.hostname,u.port),timeout=15); self.s.settimeout(20); self.buffer=b''; self.serial=0; self.errors=[]
        key=base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        data=b''
        while b'\r\n\r\n' not in data:data+=self.s.recv(4096)
        head,self.buffer=data.split(b'\r\n\r\n',1)
        assert b'101' in head,head
    def read(self,n):
        while len(self.buffer)<n:self.buffer+=self.s.recv(max(4096,n-len(self.buffer)))
        out,self.buffer=self.buffer[:n],self.buffer[n:];return out
    def receive(self):
        a,b=self.read(2); n=b&127
        if n==126:n=struct.unpack('!H',self.read(2))[0]
        if n==127:n=struct.unpack('!Q',self.read(8))[0]
        mask=self.read(4) if b&128 else None
        data=self.read(n)
        if mask:data=bytes(v^mask[i%4] for i,v in enumerate(data))
        return json.loads(data)
    def call(self,method,params=None):
        self.serial+=1; ident=self.serial; data=json.dumps({'id':ident,'method':method,'params':params or {}}).encode(); n=len(data); mask=os.urandom(4)
        header=bytes([0x81,0x80|n]) if n<126 else bytes([0x81,0x80|126])+struct.pack('!H',n) if n<65536 else bytes([0x81,0x80|127])+struct.pack('!Q',n)
        self.s.sendall(header+mask+bytes(v^mask[i%4] for i,v in enumerate(data)))
        while True:
            result=self.receive()
            if result.get('method')=='Runtime.exceptionThrown':self.errors.append(result['params'])
            if result.get('id')==ident:
                if 'error' in result:raise RuntimeError(result['error'])
                return result.get('result',{})
    def js(self,expression):
        r=self.call('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})
        if 'exceptionDetails' in r:raise RuntimeError(r['exceptionDetails'])
        return r.get('result',{}).get('value')
    def screenshot(self,path):
        r=self.call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':True});Path(path).write_bytes(base64.b64decode(r['data']))



profile=tempfile.mkdtemp(prefix='war-arena-chrome-',dir='/private/tmp')
log=open('/private/tmp/war-arena-chrome.log','w')
chrome=subprocess.Popen(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],stdout=log,stderr=log)
try:
    portfile=Path(profile)/'DevToolsActivePort'
    for _ in range(200):
        if portfile.exists():break
        time.sleep(.1)
    port=int(portfile.read_text().splitlines()[0]);pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'))
    c=CDP(next(p['webSocketDebuggerUrl'] for p in pages if p['type']=='page'));c.call('Runtime.enable');c.call('Page.enable')
    c.call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False})
    c.call('Page.addScriptToEvaluateOnNewDocument',{'source':"const make=AudioContext.prototype.createDynamicsCompressor;AudioContext.prototype.createDynamicsCompressor=function(){const node=make.call(this);window.meter=this.createAnalyser();node.connect(window.meter);return node;}"})
    c.call('Page.navigate',{'url':'http://127.0.0.1:8082/'})
    for _ in range(100):
        if c.js('Boolean(window.SoundFX&&window.SpinArena)'):break
        time.sleep(.1)
    c.call('Runtime.evaluate',{'expression':'document.getElementById("sound").click()','userGesture':True})
    for _ in range(40):
        if c.js('SoundFX.state==="running"'):break
        time.sleep(.1)
    assert c.js('SoundFX.enabled&&SoundFX.state==="running"')
    c.js('SoundFX.play("hit",{damage:95,x:-2})');time.sleep(.08)
    power=c.js('(()=>{const a=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));})()');print('Audio waveform peak:',power,flush=True);assert power>0.00001
    checks=c.js('(()=>{for(const id of Object.keys(WarData.common))SoundFX.play("skill",{id});SoundFX.stop();for(const character of Object.keys(WarData.characters)){SoundFX.play("skill",{id:"signature",character});SoundFX.stop();}SoundFX.play("launch");SoundFX.setVolume(0);SoundFX.setVolume(.55);SoundFX.stop();return {signatures:Object.keys(SoundFX.signatures).length,voices:SoundFX.activeVoices};})()');print(checks,flush=True);assert checks['signatures']==15 and checks['voices']==0
    c.js('SoundFX.play("skill",{id:"signature",character:"zhugeliang"})');time.sleep(1);assert c.js('SoundFX.activeVoices')==0
    c.js('document.getElementById("sound").click()');time.sleep(.1);assert c.js('!SoundFX.enabled&&SoundFX.activeVoices===0');assert c.js('document.getElementById("sound").getAttribute("aria-pressed")')=='false'
    print('PASS: audio output, 8 common skills, 15 signatures, cleanup, volume and mute',flush=True);assert not c.errors,c.errors
finally:
    chrome.terminate()
    try:chrome.wait(timeout=5)
    except subprocess.TimeoutExpired:chrome.kill()
    log.close()
