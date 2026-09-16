(() => {
  const body = document.body;
  const button = document.querySelector('.motion-toggle');
  const label = button.querySelector('.motion-label');
  const symbol = button.querySelector('.motion-symbol');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const cursor = document.querySelector('.explore-cursor');
  const intro = document.querySelector('.intro');
  let userPaused = false;
  try { userPaused = localStorage.getItem('daniel-motion') === 'off'; } catch {}
  let motionOn = !preference.matches && !userPaused;
  let cursorFrame = null;
  let cursorX = 0;
  let cursorY = 0;
  let cursorTargetX = 0;
  let cursorTargetY = 0;
  let cursorVisible = false;
  const pendingFrames = new Set();

  function enabled() { return motionOn && !document.hidden; }
  function hideCursor() {
    cursorVisible = false;
    cursor.classList.remove('is-visible');
    if (cursorFrame !== null) cancelAnimationFrame(cursorFrame);
    cursorFrame = null;
  }
  function resetTransforms() {
    document.querySelectorAll('.feature-image').forEach(el => {
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
      el.style.removeProperty('--shine-x');
      el.style.removeProperty('--shine-y');
    });
    document.querySelectorAll('.inline-link, .contact-links a').forEach(el => el.style.removeProperty('transform'));
    intro.style.removeProperty('--spot-x');
    intro.style.removeProperty('--spot-y');
  }
  function applyMotion() {
    body.classList.toggle('effects-off', !motionOn);
    body.classList.toggle('motion-enabled', motionOn);
    button.setAttribute('aria-pressed', String(motionOn));
    button.disabled = preference.matches;
    button.setAttribute('aria-label', preference.matches ? 'System reduced motion is enabled' : motionOn ? 'Pause animation effects' : 'Resume animation effects');
    label.textContent = preference.matches ? 'Reduced motion' : motionOn ? 'Motion on' : 'Motion off';
    symbol.textContent = motionOn ? 'Ⅱ' : '▷';
    if (!motionOn) {
      hideCursor();
      resetTransforms();
      pendingFrames.forEach(id => cancelAnimationFrame(id));
      pendingFrames.clear();
      document.querySelectorAll('.effect-await, .reveal-pending').forEach(el => {
        el.classList.remove('effect-await', 'reveal-pending');
        el.classList.add('effect-in');
      });
      if (typeof document.getAnimations === 'function') document.getAnimations().forEach(animation => animation.cancel());
    }
  }
  button.addEventListener('click', () => {
    motionOn = !motionOn;
    userPaused = !motionOn;
    try { localStorage.setItem('daniel-motion', motionOn ? 'on' : 'off'); } catch {}
    applyMotion();
  });
  preference.addEventListener('change', () => {
    motionOn = !preference.matches && !userPaused;
    applyMotion();
  });
  finePointer.addEventListener('change', () => { hideCursor(); resetTransforms(); });
  document.addEventListener('visibilitychange', () => {
    body.classList.toggle('page-inactive', document.hidden);
    if (document.hidden) { hideCursor(); resetTransforms(); }
  });
  applyMotion();

  function drawCursor() {
    if (!enabled() || !cursorVisible || !finePointer.matches) { hideCursor(); return; }
    cursorX += (cursorTargetX - cursorX) * .2;
    cursorY += (cursorTargetY - cursorY) * .2;
    cursor.style.transform = 'translate3d(' + (cursorX + 10) + 'px,' + (cursorY - 24) + 'px,0)';
    const lean = Math.max(-14, Math.min(14, (cursorTargetX - cursorX) * .4));
    cursor.style.setProperty('--corndog-tilt', lean.toFixed(2) + 'deg');
    if (Math.abs(cursorTargetX - cursorX) + Math.abs(cursorTargetY - cursorY) > .15) cursorFrame = requestAnimationFrame(drawCursor);
    else cursorFrame = null;
  }
  for (const card of document.querySelectorAll('.feature-card')) {
    const photograph = card.querySelector('.feature-image');
    let tiltFrame = null;
    let pointerX = 0;
    let pointerY = 0;
    card.addEventListener('pointerenter', event => {
      if (!enabled() || !finePointer.matches || event.pointerType === 'touch') return;
      cursorX = cursorTargetX = event.clientX;
      cursorY = cursorTargetY = event.clientY;
      cursorVisible = true;
      cursor.style.transform = 'translate3d(' + (cursorX + 10) + 'px,' + (cursorY - 24) + 'px,0)';
      cursor.style.setProperty('--corndog-tilt', '0deg');
      cursor.classList.add('is-visible');
    });
    card.addEventListener('pointermove', event => {
      if (!enabled() || !finePointer.matches || event.pointerType === 'touch') return;
      cursorTargetX = event.clientX;
      cursorTargetY = event.clientY;
      if (cursorFrame === null) cursorFrame = requestAnimationFrame(drawCursor);
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (tiltFrame !== null) return;
      tiltFrame = requestAnimationFrame(() => {
        pendingFrames.delete(tiltFrame);
        tiltFrame = null;
        if (!enabled()) return;
        const rect = photograph.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = Math.max(0, Math.min(1, (pointerX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (pointerY - rect.top) / rect.height));
        photograph.style.setProperty('--tilt-x', ((.5 - y) * 5).toFixed(2) + 'deg');
        photograph.style.setProperty('--tilt-y', ((x - .5) * 6).toFixed(2) + 'deg');
        photograph.style.setProperty('--shine-x', (x * 100).toFixed(1) + '%');
        photograph.style.setProperty('--shine-y', (y * 100).toFixed(1) + '%');
      });
      pendingFrames.add(tiltFrame);
    });
    card.addEventListener('pointerleave', () => {
      hideCursor();
      if (tiltFrame !== null) { cancelAnimationFrame(tiltFrame); pendingFrames.delete(tiltFrame); tiltFrame = null; }
      photograph.style.setProperty('--tilt-x', '0deg');
      photograph.style.setProperty('--tilt-y', '0deg');
    });
  }
  // Gentle attraction only on fine-pointer devices; touch and keyboard retain fixed targets.
  document.querySelectorAll('.inline-link, .contact-links a').forEach(link => {
    link.addEventListener('pointermove', event => {
      if (!enabled() || !finePointer.matches || event.pointerType === 'touch') return;
      const rect = link.getBoundingClientRect();
      const x = Math.max(-5, Math.min(5, (event.clientX - rect.left - rect.width / 2) * .055));
      const y = Math.max(-3, Math.min(3, (event.clientY - rect.top - rect.height / 2) * .1));
      link.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    });
    link.addEventListener('pointerleave', () => link.style.removeProperty('transform'));
    link.addEventListener('focus', () => link.style.removeProperty('transform'));
  });
  intro.addEventListener('pointermove', event => {
    if (!enabled() || !finePointer.matches || event.pointerType === 'touch') return;
    const rect = intro.getBoundingClientRect();
    intro.style.setProperty('--spot-x', (event.clientX - rect.left) + 'px');
    intro.style.setProperty('--spot-y', (event.clientY - rect.top) + 'px');
  });
  intro.addEventListener('pointerleave', () => {
    intro.style.removeProperty('--spot-x');
    intro.style.removeProperty('--spot-y');
  });

  if ('IntersectionObserver' in window) {
    const entrance = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('effect-await');
        entry.target.classList.add('effect-in');
        entrance.unobserve(entry.target);
      }
    }, { threshold: .08, rootMargin: '0px 0px 35px 0px' });
    document.querySelectorAll('.feature-card, .section-bar, .film-entry').forEach((element, index) => {
      element.style.setProperty('--entrance-delay', (index % 2) * 100 + 'ms');
      if (motionOn && element.getBoundingClientRect().top > window.innerHeight) element.classList.add('effect-await');
      entrance.observe(element);
    });
  }
})();
