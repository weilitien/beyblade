window.thirdPeer = new Peer();
window.thirdRejected = false;
thirdPeer.on('open', () => {
  const link = thirdPeer.connect('sanguo-spin-' + RemoteRoom.code, {
    serialization: 'json',
  });
  link.on('data', (m) => {
    if (m.type === 'reject' && m.reason === 'full') window.thirdRejected = true;
  });
});
void 0;
