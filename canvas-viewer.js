// canvas-viewer.js - Interactive Claude Design Canvas Engine
(function() {
  function initCanvas() {
    const dcRoot = document.getElementById('dc-root');
    if (!dcRoot) {
      setTimeout(initCanvas, 50);
      return;
    }

    // Wait for component to render its first child
    const hostEl = dcRoot.querySelector('.sc-host') || dcRoot;
    if (!hostEl || !hostEl.firstElementChild) {
      setTimeout(initCanvas, 50);
      return;
    }

    // Prevent duplicate initialization
    if (document.getElementById('canvas-viewport')) return;

    // Viewport: fills screen, infinite dot grid
    const viewport = document.createElement('div');
    viewport.id = 'canvas-viewport';
    viewport.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background-color: #E5E1D7;
      background-image: radial-gradient(#B8B1A2 1.5px, transparent 1.5px);
      background-size: 24px 24px;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      z-index: 10;
    `;

    // Layer: transformed with pan & zoom
    const canvasLayer = document.createElement('div');
    canvasLayer.id = 'canvas-layer';
    canvasLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      will-change: transform;
      user-select: auto;
      -webkit-user-select: auto;
    `;

    document.body.appendChild(viewport);
    viewport.appendChild(canvasLayer);
    canvasLayer.appendChild(dcRoot);

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';

    let scale = 1;
    let x = 0;
    let y = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startX = 0;
    let startY = 0;
    let spacePressed = false;
    let handToolActive = false;

    function updateTransform(smooth = false) {
      if (smooth) {
        canvasLayer.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
        setTimeout(() => { canvasLayer.style.transition = ''; }, 300);
      } else {
        canvasLayer.style.transition = '';
      }
      canvasLayer.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      viewport.style.backgroundPosition = `${x}px ${y}px`;
      updateHud();
    }

    function fitToScreen(smooth = true) {
      const targetEl = hostEl.firstElementChild || dcRoot;
      const rect = targetEl.getBoundingClientRect();
      const contentWidth = rect.width / (scale || 1);
      const contentHeight = rect.height / (scale || 1);

      if (contentWidth < 100 || contentHeight < 100) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const padX = vw > 768 ? 64 : 20;
      const padY = vh > 768 ? 48 : 20;

      const scaleX = (vw - padX * 2) / contentWidth;
      const scaleY = (vh - padY * 2) / contentHeight;
      let targetScale = Math.min(scaleX, scaleY);
      targetScale = Math.max(0.18, Math.min(targetScale, 1.0));

      scale = targetScale;
      x = Math.max(padX, (vw - contentWidth * scale) / 2);
      y = padY;

      updateTransform(smooth);
    }

    function zoomAt(targetScale, clientX, clientY, smooth = false) {
      const newScale = Math.max(0.12, Math.min(targetScale, 2.5));
      if (Math.abs(newScale - scale) < 0.001) return;

      const factor = newScale / scale;
      x = clientX - (clientX - x) * factor;
      y = clientY - (clientY - y) * factor;
      scale = newScale;

      updateTransform(smooth);
    }

    // Wheel event (Zoom & Pan)
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = -e.deltaY * 0.012;
        zoomAt(scale * (1 + zoomDelta), e.clientX, e.clientY);
      } else {
        const isTouchPad = Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) < 40;
        if (isTouchPad) {
          x -= e.deltaX;
          y -= e.deltaY;
          updateTransform();
        } else {
          const factor = e.deltaY < 0 ? 1.15 : 0.85;
          zoomAt(scale * factor, e.clientX, e.clientY, true);
        }
      }
    }, { passive: false });

    // Drag / Pan events
    viewport.addEventListener('mousedown', (e) => {
      const onInteractiveEl = e.target.closest('a, button, input, [role="button"]');
      const isMiddleClick = e.button === 1;
      const isLeftClick = e.button === 0;

      if (isMiddleClick || (isLeftClick && (!onInteractiveEl || spacePressed || handToolActive))) {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startX = x;
        startY = y;
        viewport.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      x = startX + (e.clientX - dragStartX);
      y = startY + (e.clientY - dragStartY);
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        viewport.style.cursor = (spacePressed || handToolActive) ? 'grab' : 'default';
      }
    });

    // Spacebar to pan
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        spacePressed = true;
        viewport.style.cursor = 'grab';
        e.preventDefault();
      }
      if ((e.key === '0' || e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        fitToScreen(true);
      }
      if ((e.key === '+' || e.key === '=') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        zoomAt(scale * 1.2, window.innerWidth / 2, window.innerHeight / 2, true);
      }
      if (e.key === '-' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        zoomAt(scale * 0.8, window.innerWidth / 2, window.innerHeight / 2, true);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        spacePressed = false;
        viewport.style.cursor = handToolActive ? 'grab' : 'default';
      }
    });

    // Touch Support for Mobile / Tablets
    let touchStartDist = 0;
    let touchStartScale = 1;
    let touchMidX = 0;
    let touchMidY = 0;

    viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        startX = x;
        startY = y;
      } else if (e.touches.length === 2) {
        isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartScale = scale;
        touchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        touchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isDragging) {
        x = startX + (e.touches[0].clientX - dragStartX);
        y = startY + (e.touches[0].clientY - dragStartY);
        updateTransform();
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        zoomAt(touchStartScale * (dist / touchStartDist), touchMidX, touchMidY);
      }
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
      isDragging = false;
      touchStartDist = 0;
    });

    // Floating Canvas HUD / Toolbar
    const hud = document.createElement('div');
    hud.id = 'canvas-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 33, 58, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      padding: 6px 14px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32), 0 2px 6px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    `;

    hud.innerHTML = `
      <button id="canvas-btn-zoom-out" style="background:none;border:none;color:#FFFFFF;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background .15s" title="Zoom Out (−)">−</button>
      <span id="canvas-zoom-text" style="min-width:44px;text-align:center;cursor:pointer;padding:4px 6px;border-radius:6px;font-variant-numeric:tabular-nums;transition:background .15s" title="Click to reset 100%">100%</span>
      <button id="canvas-btn-zoom-in" style="background:none;border:none;color:#FFFFFF;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background .15s" title="Zoom In (+)">+</button>
      <div style="width:1px;height:18px;background:rgba(255,255,255,0.2);margin:0 4px"></div>
      <button id="canvas-btn-fit" style="background:rgba(255,255,255,0.14);border:none;color:#FFFFFF;cursor:pointer;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;transition:background .15s" title="Fit to Screen (F)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        Fit View
      </button>
      <div style="width:1px;height:18px;background:rgba(255,255,255,0.2);margin:0 4px"></div>
      <button id="canvas-btn-hand" style="background:none;border:none;color:#FFFFFF;cursor:pointer;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:5px;transition:background .15s" title="Toggle Pan Tool">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v7"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83L7 15"/></svg>
        Pan
      </button>
      <span style="font-size:11px;color:rgba(255,255,255,0.65);margin-left:6px;padding-left:8px;border-left:1px solid rgba(255,255,255,0.2)">Drag to pan · Scroll to zoom</span>
    `;
    document.body.appendChild(hud);

    const btnZoomOut = document.getElementById('canvas-btn-zoom-out');
    const btnZoomIn = document.getElementById('canvas-btn-zoom-in');
    const zoomText = document.getElementById('canvas-zoom-text');
    const btnFit = document.getElementById('canvas-btn-fit');
    const btnHand = document.getElementById('canvas-btn-hand');

    function updateHud() {
      zoomText.textContent = `${Math.round(scale * 100)}%`;
    }

    btnZoomOut.addEventListener('click', () => zoomAt(scale * 0.85, window.innerWidth / 2, window.innerHeight / 2, true));
    btnZoomIn.addEventListener('click', () => zoomAt(scale * 1.15, window.innerWidth / 2, window.innerHeight / 2, true));
    zoomText.addEventListener('click', () => zoomAt(1, window.innerWidth / 2, window.innerHeight / 2, true));
    btnFit.addEventListener('click', () => fitToScreen(true));
    btnHand.addEventListener('click', () => {
      handToolActive = !handToolActive;
      btnHand.style.background = handToolActive ? '#0F766E' : 'none';
      viewport.style.cursor = handToolActive ? 'grab' : 'default';
    });

    [btnZoomOut, btnZoomIn, zoomText, btnFit].forEach(b => {
      b.addEventListener('mouseenter', () => { b.style.backgroundColor = 'rgba(255,255,255,0.2)'; });
      b.addEventListener('mouseleave', () => { b.style.backgroundColor = b === btnFit ? 'rgba(255,255,255,0.14)' : 'none'; });
    });

    // Auto-fit after components finish rendering
    setTimeout(() => { fitToScreen(false); }, 300);
    setTimeout(() => { fitToScreen(false); }, 800);

    window.addEventListener('resize', () => { fitToScreen(false); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCanvas);
  } else {
    initCanvas();
  }
})();
