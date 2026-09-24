'use strict';
// Three shared PeerServer IDs enforce the room limit without a separate database.
window.PublicLobby = (() => {
  const rooms = ['1', '2', '3'];
  const labels = {
    checking: '查詢中…',
    empty: '空房 · 0 / 2',
    waiting: '等待對手 · 1 / 2',
    full: '已滿 · 2 / 2',
    unknown: '暫時無法確認',
    outdated: '版本不同，請重新整理',
  };
  let active = false;
  let refreshing = false;
  let timer;
  const states = new Map(rooms.map((room) => [room, 'checking']));

  function render() {
    const container = document.getElementById('public-rooms');
    if (!container) return;
    if (!container.children.length) {
      for (const room of rooms) {
        const card = document.createElement('div');
        card.className = 'public-room';
        card.innerHTML = `<strong>ROOM 0${room} / 房間 ${room}</strong><p></p><button type="button" data-room="${room}"></button>`;
        card.querySelector('button').onclick = () => {
          if (RemoteRoom.role || !active) return;
          const state = states.get(room);
          if (state === 'empty') {
            SpinArena.reset();
            RemoteRoom.create(room);
          } else if (state === 'waiting') RemoteRoom.join(room);
        };
        container.append(card);
      }
    }
    rooms.forEach((room, index) => {
      const own = RemoteRoom.code === room && !!RemoteRoom.role;
      const state = own ? (RemoteRoom.connected ? 'full' : 'waiting') : states.get(room);
      const card = container.children[index];
      card.dataset.state = state;
      card.querySelector('p').textContent =
        labels[state] + (own ? ' · 你所在的房間' : '');
      const button = card.querySelector('button');
      button.textContent = own
        ? RemoteRoom.connected
          ? '已進入對戰'
          : '連線／等待中'
        : state === 'empty'
          ? '開房等待 · P1'
          : state === 'waiting'
            ? '加入對戰 · P2'
            : '暫不可加入';
      button.disabled = !!RemoteRoom.role || !['empty', 'waiting'].includes(state);
    });
    document.getElementById('room-refresh').disabled = refreshing;
  }

  // A probe never reserves a player seat. Only a confirmed missing ID means empty;
  // unreachable hosts and service failures remain unknown instead of inviting collisions.
  function probe(room) {
    return new Promise((resolve) => {
      let client;
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        clearTimeout(deadline);
        client?.destroy();
        resolve(value);
      };
      const deadline = setTimeout(() => finish('unknown'), 7000);
      try {
        client = new Peer(undefined, { debug: 0, ...(window.SPIN_NETWORK_CONFIG || {}) });
        client.on('open', () => {
          const connection = client.connect(RemoteRoom.prefix + room, {
            reliable: true,
            serialization: 'binary',
            metadata: { lobbyProbe: true },
          });
          connection.on('data', (data) => {
            if (data?.type === 'room-info') {
              finish(
                data.version !== RemoteRoom.version
                  ? 'outdated'
                  : data.occupied
                    ? 'full'
                    : 'waiting',
              );
            }
          });
          connection.on('error', () => finish('unknown'));
        });
        client.on('error', (error) =>
          finish(error.type === 'peer-unavailable' ? 'empty' : 'unknown'),
        );
        client.on('disconnected', () => finish('unknown'));
      } catch {
        finish('unknown');
      }
    });
  }

  async function refresh() {
    if (!active || refreshing) return;
    clearTimeout(timer);
    refreshing = true;
    render();
    document.getElementById('lobby-status').textContent = '正在更新房間…';
    await Promise.all(
      rooms.map(async (room) => {
        const state = await probe(room);
        states.set(room, state);
        render();
      }),
    );
    refreshing = false;
    render();
    document.getElementById('lobby-status').textContent = '房間已更新 · 每 10 秒自動更新';
    if (active) timer = setTimeout(refresh, 10000);
  }
  return {
    render,
    refresh,
    setActive(value) {
      active = value;
      clearTimeout(timer);
      if (active) refresh();
    },
  };
})();
