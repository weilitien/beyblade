'use strict';
// PeerServer only introduces peers. Battle snapshots use an encrypted WebRTC data channel.
window.RemoteRoom = (() => {
  const VERSION = 'spin-arena-remote-4',
    PREFIX = 'sanguo-spin-public-';
  let peer = null,
    connection = null,
    role = null,
    connected = false,
    code = '',
    generation = 0,
    lastSeen = 0,
    lastSent = 0,
    lastPing = 0,
    sequence = 0,
    acceptedSequence = 0,
    timeout = null,
    handlers = {};
  const state = () => ({ role, connected, code });
  function status(message) {
    handlers.status?.(message, state());
  }
  function send(data) {
    if (connection?.open && connection.bufferSize < 4) {
      connection.send(data);
      return true;
    }
    return false;
  }
  function close(message = '已離開房間。') {
    generation++;
    clearTimeout(timeout);
    connected = false;
    const c = connection,
      p = peer;
    connection = null;
    peer = null;
    role = null;
    code = '';
    c?.close();
    p?.destroy();
    status(message);
    handlers.closed?.();
  }
  function lost(message) {
    const hadRole = !!role;
    close(message);
    if (hadRole) handlers.lost?.(message);
  }
  function attach(c, gen) {
    connection = c;
    lastSeen = performance.now();
    c.on('open', () => {
      if (gen !== generation) return;
      if (role === 'guest') send({ type: 'hello', version: VERSION });
    });
    c.on('data', (m) => {
      if (gen !== generation || !m || typeof m !== 'object') return;
      lastSeen = performance.now();
      if (m.type === 'reject') {
        lost(
          m.reason === 'full'
            ? '房間已有兩位玩家。'
            : '遊戲版本不同，請雙方重新整理後再連線。',
        );
        return;
      }
      if (!connected) {
        if (role === 'host' && m.type === 'hello') {
          if (m.version !== VERSION) {
            send({ type: 'reject', reason: 'version' });
            setTimeout(() => c.close(), 150);
            return;
          }
          send({ type: 'welcome', version: VERSION });
          connected = true;
        } else if (role === 'guest' && m.type === 'welcome' && m.version === VERSION) {
          connected = true;
        } else return;
        clearTimeout(timeout);
        status(
          role === 'host'
            ? 'P2 已加入。選好武將後請按準備。'
            : '已加入房間，你是 P2。選好武將後請按準備。',
        );
        handlers.connected?.(state());
        return;
      }
      if (
        role === 'host' &&
        m.type === 'input' &&
        Number.isSafeInteger(m.seq) &&
        m.seq > acceptedSequence
      ) {
        acceptedSequence = m.seq;
        handlers.input?.(m.action, m.value);
      } else if (role === 'guest' && m.type === 'state') handlers.snapshot?.(m.value);
    });
    c.on('close', () => {
      if (gen === generation) lost('對手已離線，對戰已停止。請重新建立或加入房間。');
    });
    c.on('error', () => {
      if (gen === generation) lost('連線中斷，對戰已停止。請重新建立或加入房間。');
    });
    timeout = setTimeout(() => {
      if (gen === generation && !connected)
        lost('連線逾時。請確認房主仍在線，或換個網路再試。');
    }, 20000);
  }
  function start(kind, room = '') {
    close('正在連線…');
    role = kind;
    code = room;
    const gen = generation;
    sequence = 0;
    acceptedSequence = 0;
    lastSent = 0;
    lastPing = 0;
    if (!window.Peer) {
      lost('連線元件無法載入，請重新整理。');
      return;
    }
    try {
      peer = new Peer(kind === 'host' ? PREFIX + code : undefined, {
        debug: 0,
        ...(window.SPIN_NETWORK_CONFIG || {}),
      });
    } catch {
      lost('此瀏覽器無法建立 WebRTC 連線。');
      return;
    }
    status('正在連接房間服務…');
    timeout = setTimeout(() => {
      if (gen === generation && !connected) lost('房間服務連線逾時，請稍後再試。');
    }, 20000);
    peer.on('open', () => {
      if (gen !== generation) return;
      clearTimeout(timeout);
      if (kind === 'host') status('房間已建立，等待其他玩家參賽。請保持此頁開啟。');
      else
        attach(
          // Binary transport automatically chunks larger effect snapshots.
          peer.connect(PREFIX + code, { reliable: true, serialization: 'binary' }),
          gen,
        );
    });
    peer.on('connection', (c) => {
      if (gen !== generation) return;
      if (kind === 'host' && c.metadata?.lobbyProbe === true) {
        const cleanup = setTimeout(() => c.close(), 5000);
        c.on('error', () => clearTimeout(cleanup));
        c.on('close', () => clearTimeout(cleanup));
        c.on('open', () => {
          c.send({ type: 'room-info', occupied: !!connection, version: VERSION });
          setTimeout(() => c.close(), 300);
        });
        return;
      }
      if (kind !== 'host' || connection) {
        c.on('open', () => {
          c.send({ type: 'reject', reason: 'full' });
          setTimeout(() => c.close(), 150);
        });
        return;
      }
      attach(c, gen);
    });
    peer.on('error', (e) => {
      if (gen !== generation) return;
      lost(
        e.type === 'peer-unavailable'
          ? '房主已離開，請重新整理大廳。'
          : e.type === 'unavailable-id'
            ? '這個房間剛被其他玩家建立，請重新整理後加入。'
            : '房間服務連線失敗。請檢查網路後再試。',
      );
    });
    peer.on('disconnected', () => {
      if (gen !== generation) return;
      if (connected) status('房間服務暫時離線；現有對戰連線仍可使用。');
      else lost('房間服務離線，請重新建立或加入房間。');
    });
  }
  function tick(now) {
    if (!connected) return;
    if (now - lastSeen > 10000) {
      lost('超過 10 秒未收到對手訊息，對戰已停止。');
      return;
    }
    if (role === 'host' && now - lastSent >= 50) {
      lastSent = now;
      send({ type: 'state', value: handlers.capture?.() });
    }
    if (role === 'guest' && now - lastPing >= 1000) {
      lastPing = now;
      send({ type: 'ping' });
    }
  }
  return {
    configure: (h) => {
      handlers = h;
    },
    get role() {
      return role;
    },
    get connected() {
      return connected;
    },
    get code() {
      return code;
    },
    prefix: PREFIX,
    version: VERSION,
    create: (room) => {
      if (!role && /^[123]$/.test(String(room))) start('host', String(room));
    },
    join: (room) => {
      if (!role && /^[123]$/.test(String(room))) start('guest', String(room));
    },
    leave: close,
    tick,
    command: (action, value) =>
      connected &&
      role === 'guest' &&
      send({ type: 'input', seq: ++sequence, action, value }),
  };
})();
