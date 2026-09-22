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
    c.call('Page.addScriptToEvaluateOnNewDocument',{'source':'window.requestAnimationFrame=()=>0;'})
    c.call('Page.navigate',{'url':'http://127.0.0.1:8082/'})
    for _ in range(100):
        if c.js('Boolean(window.SpinArena)'):break
        time.sleep(.1)
    result=c.js(r"""(()=>{
      const a=SpinArena,g=a.game,checks=[],ok=(v,t)=>{if(!v)throw Error(t);checks.push(t);};
      const start=()=>{a.reset();a.launch();g.charge=.81;a.launch();for(let i=0;i<181;i++)a.simulate(1/120);g.aiEnabled=false;};
      for(const loser of [0,1]){start();const prefix=loser?'ai':'your';g.actors[loser].hp=1;updateUI();g.hit(g.actors[1-loser],g.actors[loser]);processEvents();ok(g.phase==='result'&&g.actors[loser].hp===0,'Lethal damage P'+(loser+1));ok(document.getElementById(prefix+'-spin').textContent.startsWith('0 /'),'Zero HP label immediately P'+(loser+1));ok(document.getElementById(prefix+'-bar').style.width==='0%','Zero bar immediately P'+(loser+1));}
      start();g.actors[0].hp=0;g.actors[1].hp=0;g.checkEnd();processEvents();ok(g.winner===null&&['your','ai'].every(p=>document.getElementById(p+'-spin').textContent.startsWith('0 /')),'Draw updates both HP labels');
      start();g.actors[1].integrity=.01;g.hit(g.actors[0],g.actors[1]);processEvents();ok(g.finishKind==='爆裂終結'&&g.actors[1].hp>0&&!document.getElementById('ai-spin').textContent.startsWith('0 /'),'Burst preserves remaining HP');
      start();const hp=g.actors[1].hp;g.end(0,'出界落敗');processEvents();ok(g.actors[1].hp===hp,'Ring out preserves remaining HP');
      const s=JSON.parse(JSON.stringify(captureNetwork()));s.actors[1].hp=0;s.actors[1].spin=75;applyNetwork(s);ok(document.getElementById('ai-bar').style.width==='0%'&&document.getElementById('ai-spin').textContent.startsWith('0 /'),'Remote snapshot renders HP without stale derived spin');return checks;
    })()""")
    print(result,flush=True);assert not c.errors,c.errors

finally:
    chrome.terminate()
    try:chrome.wait(timeout=5)
    except subprocess.TimeoutExpired:chrome.kill()
    log.close()
