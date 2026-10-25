(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const audio = $('finale-audio');
  const colors = ['#ffd46b', '#f18b45', '#fff4c5', '#77d2bc', '#ef96af', '#a7baf7', '#e9b839'];
  let soundGeneration = 0, clearConfetti = null;

  function soundUI(playing, message) {
    const button = $('finale-sound');
    if (!button) return;
    button.textContent = playing ? '■ Stoppa fanfaren' : '♫ Spela fanfaren';
    button.setAttribute('aria-pressed', String(playing));
    $('finale-sound-status').textContent = message || '';
  }
  function stopSound(message) {
    soundGeneration++;
    audio.pause(); audio.removeAttribute('src'); audio.load();
    soundUI(false, message);
  }
  function playSound() {
    const generation = ++soundGeneration;
    audio.src = '/adventure/audio/final-fanfare.m4a';
    audio.volume = 1;
    soundUI(true, 'Din segerfanfar spelas!');
    const failed = () => {
      if (generation === soundGeneration) stopSound('Tryck på Spela fanfaren för att starta ljudet.');
    };
    // Called directly by the completion/replay click, including on mobile Safari.
    try { audio.play().catch(failed); } catch { failed(); }
  }
  audio.addEventListener('ended', () => stopSound('Vilken månad. Vilken insats!'));
  audio.addEventListener('error', () => {
    if (audio.hasAttribute('src')) stopSound('Ljudet kunde inte spelas. Försök igen med Spela fanfaren.');
  });

  function confetti() {
    clearConfetti?.();
    const canvas = $('finale-confetti');
    const context = canvas.getContext('2d');
    if (!context) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0, height = 0, ratio = 1, frame = 0, previous = 0, elapsed = 0, burstAt = 0;
    let particles = [];
    const random = (a, b) => a + Math.random() * (b - a);
    const limit = () => width < 700 ? 1000 : 1600;
    function draw(p) {
      context.save();
      context.translate(p.x, p.y); context.rotate(p.angle);
      const overCopy = p.x > width * .12 && p.x < width * .88 && p.y > height * .4 && p.y < height * .86;
      context.globalAlpha = p.alpha * (overCopy ? .62 : 1);
      context.fillStyle = p.color;
      const flutter = .35 + Math.abs(Math.cos(p.phase)) * .65;
      if (p.shape === 0) {
        context.beginPath(); context.ellipse(0, 0, p.size * .5 * flutter, p.size * .5, 0, 0, Math.PI * 2); context.fill();
      } else context.fillRect(-p.size * .5, -p.size * .3, p.size * flutter, p.size * (p.shape === 2 ? 2.6 : .65));
      context.restore();
    }
    function particle(x, y, vx, vy, gravity = 95) {
      return { x, y, vx, vy, gravity, angle: random(0, Math.PI * 2), spin: random(-7, 7), phase: random(0, 6), size: random(5, 12), color: colors[Math.floor(random(0, colors.length))], alpha: 1, shape: Math.floor(random(0, 3)) };
    }
    function cannon(side, count) {
      const x = side ? width + 15 : -15;
      for (let n = 0; n < count && particles.length < limit(); n++) {
        particles.push(particle(x, height * random(.75, 1.05), (side ? -1 : 1) * random(100, 480), -random(16, 28) * Math.sqrt(height), random(230, 380)));
      }
    }
    function resize() {
      const oldWidth = width || innerWidth, oldHeight = height || innerHeight;
      width = innerWidth; height = innerHeight;
      particles = particles.slice(0, limit());
      ratio = Math.min(devicePixelRatio || 1, width < 700 ? 1.5 : 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      for (const p of particles) { p.x *= width / oldWidth; p.y *= height / oldHeight; }
      canvas.dataset.particles = particles.length;
      if (reduced) {
        context.clearRect(0, 0, width, height);
        particles.forEach(draw);
      }
    }
    resize();
    // An immediate full-screen shower, followed by repeated side cannons and rain.
    for (let n = 0; n < (reduced ? 240 : width < 700 ? 450 : 700); n++) particles.push(particle(random(0, width), random(0, height), random(-35, 35), random(25, 120), 35));
    if (reduced) {
      particles.forEach(draw); canvas.dataset.motion = 'still';
    } else {
      cannon(0, 220); cannon(1, 220); canvas.dataset.motion = 'celebrating';
      function tick(now) {
        const dt = previous ? Math.min(.04, (now - previous) / 1000) : 0;
        previous = now; elapsed += dt;
        context.clearRect(0, 0, width, height);
        if (elapsed < 14) {
          if (elapsed >= burstAt) { cannon(Math.round(burstAt) % 2, 150); burstAt += .7; }
          for (let n = 0; n < 5 && particles.length < limit(); n++) particles.push(particle(random(-20, width + 20), -20, random(-45, 45), random(40, 130), 45));
        }
        const fade = Math.min(1, Math.max(0, (23 - elapsed) / 2));
        particles = particles.filter(p => p.y < height + 70 && p.x > -500 && p.x < width + 500);
        for (const p of particles) {
          p.vy += p.gravity * dt; p.x += (p.vx + Math.sin(elapsed + p.phase) * 25) * dt; p.y += p.vy * dt;
          p.vx *= 1 - dt * .12; p.angle += p.spin * dt; p.phase += dt * 5; p.alpha = fade;
          draw(p);
        }
        canvas.dataset.particles = particles.length;
        if (elapsed < 23) frame = requestAnimationFrame(tick);
        else { context.clearRect(0, 0, width, height); canvas.dataset.motion = 'complete'; }
      }
      frame = requestAnimationFrame(tick);
    }
    canvas.dataset.particles = particles.length;
    window.addEventListener('resize', resize);
    clearConfetti = () => {
      cancelAnimationFrame(frame); window.removeEventListener('resize', resize);
      context.clearRect(0, 0, width, height); particles = []; canvas.dataset.particles = '0'; canvas.dataset.motion = 'stopped';
      clearConfetti = null;
    };
  }
  function stop() { clearConfetti?.(); stopSound(); }
  function celebrate() { stop(); confetti(); playSound(); }
  function markup(rider, bossesDefeated) {
    const leaves = Array.from({ length: 8 }, (_, n) => {
      const y = 219 - n * 22, x = 65 - Math.sin(n / 7 * Math.PI) * 32;
      return `<ellipse cx="${x}" cy="${y}" rx="7" ry="18" transform="rotate(-38 ${x} ${y})"/><ellipse cx="${360 - x}" cy="${y}" rx="7" ry="18" transform="rotate(38 ${360 - x} ${y})"/>`;
    }).join('');
    return `<section class="finale-shell"><canvas id="finale-confetti" aria-hidden="true"></canvas><div class="finale-sound-controls"><button type="button" id="finale-sound" aria-pressed="false">♫ Spela fanfaren</button><span id="finale-sound-status" class="sr-only" role="status"></span></div><div class="finale-content"><p class="finale-kicker">SOBER OKTOBER · 1–31 OKTOBER 2026</p><div class="finale-crest" aria-hidden="true"><svg class="finale-wreath" viewBox="0 0 360 270"><g fill="#e7bb58">${leaves}</g><path d="M63 235Q8 120 63 40M297 235Q352 120 297 40" fill="none" stroke="#e7bb58" stroke-width="3"/><path d="m156 33-12-23 24 10 12-18 12 18 24-10-12 23Z" fill="#ffd570"/></svg><div class="finale-rider">${rider}</div><span class="finale-ribbon">EN SANN SOKTOBERIAN</span></div><p class="finale-achievement">PANNBEN: ${bossesDefeated} · FRESTELSERNA: 0<br>BAKRUSBARONEN BESEGRAD. HELA MÅNADEN AVKLARAD.</p><h2 id="boss-dialog-title">31 dagar.<em>Du gjorde det!</em></h2><p class="finale-copy">Du stod emot frestelserna. Du tog dig hela vägen.<br><strong>Du har klarat Sober Oktober!</strong></p><div class="finale-actions"><button type="button" class="primary-button" id="continue-journey">Tillbaka till poängjakten →</button><button type="button" id="finale-replay">Fira igen ✦</button></div><p class="finale-footnote">Njut av segern. Du kan fortsätta samla poäng fram till kl. 23.59.59.</p></div><span class="finale-star finale-star-one" aria-hidden="true">✦</span><span class="finale-star finale-star-two" aria-hidden="true">✦</span><span class="finale-star finale-star-three" aria-hidden="true">✦</span></section>`;
  }
  function start() {
    $('finale-sound').addEventListener('click', () => {
      if (audio.hasAttribute('src')) stopSound('Fanfaren är stoppad.'); else playSound();
    });
    $('finale-replay').addEventListener('click', celebrate);
    celebrate();
  }
  window.AdventureFinale = Object.freeze({ markup, start, stop });
})();
