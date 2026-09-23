(() => {
  const box = (id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  const last = document
    .querySelector('#skills button:last-child')
    .getBoundingClientRect();
  return {
    canvas: box('arena'),
    signature: box('signature'),
    lastBottom: last.bottom,
    viewport: innerHeight,
    width: document.documentElement.scrollWidth,
    details: document.body.classList.contains('combat-focus'),
  };
})();
