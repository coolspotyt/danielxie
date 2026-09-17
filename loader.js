(() => {
  const root = document.documentElement;
  const loader = document.querySelector('#page-loader');
  if (!loader || !root.classList.contains('has-preloader')) return;

  let finished = false;
  let deadline;
  const skip = loader.querySelector('#loader-skip');

  function finish(immediate = false) {
    if (finished) return;
    finished = true;
    window.clearTimeout(deadline);
    document.removeEventListener('keydown', onKey);
    loader.classList.add('is-leaving');
    if (document.activeElement === skip) {
      const main = document.querySelector('#main');
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
    const reveal = () => root.classList.remove('has-preloader');
    if (immediate) reveal();
    else window.setTimeout(reveal, 240);
  }

  function onKey(event) {
    if (event.key === 'Escape' || event.key === 'Tab') finish(true);
  }

  skip.addEventListener('click', () => finish(true));
  document.addEventListener('keydown', onKey);

  // Skip the intro when returning with the browser's Back button.
  window.addEventListener('pageshow', event => {
    if (event.persisted) finish(true);
  });

  // Show the animation for three seconds unless the visitor skips it.
  deadline = window.setTimeout(() => finish(), 3000);
})();
