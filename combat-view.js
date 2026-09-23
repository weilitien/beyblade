'use strict';

// 移動同一組控制項，保留既有事件與狀態；不複製按鈕或戰鬥畫布。
window.CombatView = (() => {
  const body = document.body;
  const audioControls = document.querySelector('.audio-controls');
  const audioHome = document.createComment('Audio controls return here');
  audioControls.before(audioHome);
  let returnFocus = null;
  const background = [
    ...document.querySelectorAll(
      'body > header, .intro, .mode-picker, #online-lobby, .game-layout > aside, main > .rules, main > footer',
    ),
  ];
  const previousInert = new Map();

  function refresh() {
    body.dataset.combatMode = SpinArena.mode;
    body.dataset.combatOwner = String(mySide());
    if (!body.dataset.controlSide) body.dataset.controlSide = '0';
    $('combat-p1').setAttribute('aria-pressed', String(body.dataset.controlSide === '0'));
    $('combat-p2').setAttribute('aria-pressed', String(body.dataset.controlSide === '1'));
  }

  function open() {
    if (!body.classList.contains('combat-focus')) {
      returnFocus = document.activeElement;
      body.classList.add('combat-focus');
      $('combat-audio').append(audioControls);
      for (const element of background) {
        previousInert.set(element, element.inert);
        element.inert = true;
      }
      $('arena').focus({ preventScroll: true });
    }
    refresh();
  }

  function close(pauseBattle = true) {
    if (!body.classList.contains('combat-focus')) return;
    if (
      pauseBattle &&
      ['charging', 'countdown', 'battle'].includes(SpinArena.game.phase)
    ) {
      SpinArena.pause();
    }
    body.classList.remove('combat-focus', 'combat-details-open');
    $('combat-details').setAttribute('aria-pressed', 'false');
    for (const element of background) element.inert = previousInert.get(element) || false;
    previousInert.clear();
    audioHome.after(audioControls);
    const target = returnFocus?.isConnected ? returnFocus : $('combat-open');
    target?.focus({ preventScroll: true });
  }

  $('combat-open').onclick = open;
  $('combat-close').onclick = () => close();
  $('combat-details').onclick = () => {
    const expanded = body.classList.toggle('combat-details-open');
    $('combat-details').setAttribute('aria-pressed', String(expanded));
  };
  $('combat-p1').onclick = () => {
    body.dataset.controlSide = '0';
    refresh();
  };
  $('combat-p2').onclick = () => {
    body.dataset.controlSide = '1';
    refresh();
  };
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (body.classList.contains('combat-focus')) {
      event.preventDefault();
      close();
    }
  });
  refresh();
  return { open, close, refresh };
})();
