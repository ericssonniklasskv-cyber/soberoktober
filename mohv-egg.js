(() => {
  const egg = document.querySelector('#mohv-egg');
  const appShell = document.querySelector('#app-shell');
  if (!egg || !appShell) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const controller = new AbortController();
  const listenerOptions = { signal: controller.signal };
  const edgeGap = 8;
  const fleeDistance = 120;
  const vanishDistance = 42;
  let frameId = 0;
  let lastTime = 0;
  let x = edgeGap;
  let y = edgeGap;
  let vx = 185;
  let vy = 155;
  let width = 0;
  let height = 0;
  let maxX = edgeGap;
  let maxY = edgeGap;
  let obstacles = [];
  let pointerX = -1000;
  let pointerY = -1000;
  let pointerActive = false;
  let vanishedUntil = 0;
  let pauseUntil = 0;
  let nextPauseAt = 0;
  let obstacleFrame = 0;

  const randomBetween = (min, max) => min + Math.random() * Math.max(0, max - min);

  function isAppVisible() {
    return appShell.getAttribute('aria-hidden') === 'false' && !document.hidden;
  }

  function measure() {
    const rect = egg.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    maxX = Math.max(edgeGap, window.innerWidth - width - edgeGap);
    maxY = Math.max(edgeGap, window.innerHeight - height - edgeGap);
    x = Math.min(maxX, Math.max(edgeGap, x));
    y = Math.min(maxY, Math.max(edgeGap, y));
  }

  function refreshObstacles() {
    obstacles = [...appShell.querySelectorAll('a, button:not(#mohv-egg), input, select, textarea, #page-title')]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left - 8, top: rect.top - 8, right: rect.right + 8, bottom: rect.bottom + 8 };
      });
  }

  function overlapsObstacle(nextX, nextY) {
    const right = nextX + width;
    const bottom = nextY + height;
    return obstacles.some((rect) => nextX < rect.right && right > rect.left && nextY < rect.bottom && bottom > rect.top);
  }

  function placeAt(nextX, nextY) {
    x = Math.min(maxX, Math.max(edgeGap, nextX));
    y = Math.min(maxY, Math.max(edgeGap, nextY));
    egg.style.setProperty('--egg-x', `${x}px`);
    egg.style.setProperty('--egg-y', `${y}px`);
  }

  function randomVelocity() {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(185, 235);
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
  }

  function scheduleNextPause(now) {
    nextPauseAt = now + randomBetween(9000, 19000);
  }

  function endPause(now, awayX, awayY, distance) {
    pauseUntil = 0;
    egg.classList.remove('resting');
    if (awayX != null && awayY != null) {
      const launchSpeed = randomBetween(360, 430);
      vx = (awayX / distance) * launchSpeed;
      vy = (awayY / distance) * launchSpeed;
    } else {
      randomVelocity();
    }
    scheduleNextPause(now);
  }

  function relocate() {
    measure();
    refreshObstacles();
    let nextX = edgeGap;
    let nextY = edgeGap;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      nextX = randomBetween(edgeGap, maxX);
      nextY = randomBetween(edgeGap, maxY);
      if (!overlapsObstacle(nextX, nextY)) break;
    }
    placeAt(nextX, nextY);
    randomVelocity();
  }

  function vanish(now) {
    pauseUntil = 0;
    egg.classList.remove('resting');
    scheduleNextPause(now);
    vanishedUntil = now + randomBetween(300, 600);
    egg.classList.add('vanished');
  }

  function clampSpeed(maxSpeed) {
    const speed = Math.hypot(vx, vy);
    if (speed > maxSpeed) {
      vx = (vx / speed) * maxSpeed;
      vy = (vy / speed) * maxSpeed;
    }
  }

  function animate(now) {
    frameId = 0;
    if (!isAppVisible() || reducedMotion.matches) return;

    if (vanishedUntil) {
      if (now < vanishedUntil) {
        frameId = requestAnimationFrame(animate);
        return;
      }
      vanishedUntil = 0;
      relocate();
      egg.classList.remove('vanished');
    }

    const elapsed = lastTime ? Math.min((now - lastTime) / 1000, .04) : 0;
    lastTime = now;

    let pointerDistance = Infinity;
    let awayX = 0;
    let awayY = 0;
    if (finePointer.matches && pointerActive) {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      awayX = centerX - pointerX;
      awayY = centerY - pointerY;
      pointerDistance = Math.max(1, Math.hypot(awayX, awayY));
      if (pointerDistance < vanishDistance) {
        vanish(now);
        frameId = requestAnimationFrame(animate);
        return;
      }
      if (pauseUntil && pointerDistance < fleeDistance) {
        endPause(now, awayX, awayY, pointerDistance);
      } else if (pointerDistance < fleeDistance) {
        const force = (fleeDistance - pointerDistance) * 13;
        vx += (awayX / pointerDistance) * force * elapsed;
        vy += (awayY / pointerDistance) * force * elapsed;
        clampSpeed(430);
      }
    }

    if (pauseUntil) {
      if (now < pauseUntil) {
        lastTime = now;
        frameId = requestAnimationFrame(animate);
        return;
      }
      endPause(now);
    } else if (now >= nextPauseAt && pointerDistance >= fleeDistance) {
      pauseUntil = now + randomBetween(1500, 2500);
      egg.classList.add('resting');
      lastTime = now;
      frameId = requestAnimationFrame(animate);
      return;
    }

    let nextX = x + vx * elapsed;
    let nextY = y + vy * elapsed;
    if (nextX <= edgeGap || nextX >= maxX) {
      vx *= -1;
      nextX = Math.min(maxX, Math.max(edgeGap, nextX));
    }
    if (nextY <= edgeGap || nextY >= maxY) {
      vy *= -1;
      nextY = Math.min(maxY, Math.max(edgeGap, nextY));
    }

    if (overlapsObstacle(nextX, nextY)) {
      const horizontalOnly = x + vx * elapsed;
      const verticalOnly = y + vy * elapsed;
      if (!overlapsObstacle(horizontalOnly, y)) {
        vy *= -1;
        nextY = y;
      } else if (!overlapsObstacle(x, verticalOnly)) {
        vx *= -1;
        nextX = x;
      } else {
        vx *= -1;
        vy *= -1;
        nextX = x;
        nextY = y;
      }
    }

    placeAt(nextX, nextY);
    frameId = requestAnimationFrame(animate);
  }

  function start() {
    if (frameId || reducedMotion.matches || !isAppVisible()) return;
    measure();
    lastTime = 0;
    if (!nextPauseAt) scheduleNextPause(performance.now());
    egg.classList.add('ready');
    frameId = requestAnimationFrame(animate);
  }

  function stop() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    lastTime = 0;
    pauseUntil = 0;
    nextPauseAt = 0;
    egg.classList.remove('resting');
  }

  function scheduleObstacleRefresh() {
    if (obstacleFrame) return;
    obstacleFrame = requestAnimationFrame(() => {
      obstacleFrame = 0;
      measure();
      refreshObstacles();
    });
  }

  function handleMotionPreference() {
    if (reducedMotion.matches) {
      stop();
      relocate();
      egg.classList.add('ready');
    } else {
      start();
    }
  }

  function dodgePress(event) {
    event.preventDefault();
    event.stopPropagation();
    pauseUntil = 0;
    egg.classList.remove('resting');
    relocate();
    scheduleNextPause(performance.now());
  }

  document.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    pointerActive = true;
  }, { passive: true, signal: controller.signal });
  document.addEventListener('pointerleave', () => { pointerActive = false; }, listenerOptions);
  egg.addEventListener('pointerdown', dodgePress, listenerOptions);
  egg.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  }, listenerOptions);
  window.addEventListener('resize', scheduleObstacleRefresh, listenerOptions);
  window.addEventListener('scroll', scheduleObstacleRefresh, { passive: true, signal: controller.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  }, listenerOptions);
  reducedMotion.addEventListener('change', handleMotionPreference, listenerOptions);

  const shellObserver = new MutationObserver(() => {
    if (isAppVisible()) {
      relocate();
      start();
    } else {
      stop();
      egg.classList.remove('ready');
    }
  });
  shellObserver.observe(appShell, { attributes: true, attributeFilter: ['aria-hidden'] });

  window.addEventListener('pagehide', () => {
    stop();
    if (obstacleFrame) cancelAnimationFrame(obstacleFrame);
    shellObserver.disconnect();
    controller.abort();
  }, { once: true, signal: controller.signal });

  measure();
  relocate();
  handleMotionPreference();
})();
