'use strict';
// Apple panel pixels and ppi. The reference scale is a preview choice, not iOS points.
// https://www.apple.com/iphone-duo/specs/
(function () {
  const displays = {
    inner: { width: 2670, height: 1878, ppi: 430, label: '展开 · 内屏', specs: '7.6 英寸 · 2670 × 1878' },
    outer: { width: 1398, height: 2034, ppi: 460, label: '合拢 · 外屏', specs: '5.4 英寸 · 1398 × 2034' }
  };
  const pixelsPerInch = 430 / 3;
  const bezel = 3;
  const native = window.__QIAN_NATIVE__ === true;
  document.body.classList.toggle('native-host',native);
  const mount = document.getElementById('deviceMount');
  const frame = document.getElementById('deviceFrame');
  const screen = document.getElementById('deviceScreen');
  let mode = 'inner';
  let frameRequest = 0;

  function geometry(displayMode, availableWidth, availableHeight) {
    const display = displays[displayMode];
    const width = display.width / display.ppi * pixelsPerInch;
    const height = display.height / display.ppi * pixelsPerInch;
    const frameWidth = width + bezel * 2;
    const frameHeight = height + bezel * 2;
    const scale = Math.min(1, Math.max(1, availableWidth) / frameWidth, Math.max(1, availableHeight) / frameHeight);
    return {width, height, frameWidth, frameHeight, scale};
  }

  function fit() {
    if (native) return;
    // Keep both states at the same scale so folding changes the actual footprint.
    // Use the layout viewport: opening the keyboard must not rescale the device.
    const availableWidth = mount.clientWidth;
    const availableHeight = Math.max(420, window.innerHeight - 220);
    const inner = geometry('inner', availableWidth, availableHeight);
    const outer = geometry('outer', availableWidth, availableHeight);
    const scale = Math.min(inner.scale, outer.scale);
    const current = mode === 'inner' ? inner : outer;
    screen.style.width = current.width + 'px';
    screen.style.height = current.height + 'px';
    frame.style.width = current.frameWidth + 'px';
    frame.style.height = current.frameHeight + 'px';
    frame.style.transform = 'translateX(-50%) scale(' + scale + ')';
    mount.style.height = current.frameHeight * scale + 'px';
  }

  function scheduleFit() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(() => { frameRequest = 0; fit(); });
  }

  function setMode(next) {
    if (!displays[next]) return;
    mode = next;
    frame.classList.toggle('cover-screen', mode === 'outer');
    screen.setAttribute('aria-label', mode === 'outer' ? 'iPhone Duo 外屏：合纸与摇签' : 'iPhone Duo 内屏：写愿与展签');
    document.getElementById('displayMode').textContent = displays[mode].label;
    document.getElementById('displaySpecs').textContent = displays[mode].specs;
    document.getElementById('deviceCaption').textContent = mode === 'outer'
      ? '内屏已合上 · 在外屏轻摇，待一签成后再展开'
      : '内屏如一张完整的纸 · 合上后切换至外屏';
    fit();
  }

  window.QianDevice = { setMode, geometry, getMode: () => mode };
  window.addEventListener('resize', scheduleFit);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleFit).observe(mount);
  setMode('inner');
})();
