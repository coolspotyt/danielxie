const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function closeMenu() {
  toggle.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('open');
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    toggle.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);
document.querySelector('#year').textContent = String(new Date().getFullYear());

// Work and education links open the relevant role before native anchor navigation.
function openLinkedDetail(hash) {
  if (!hash || hash === '#') return;
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  const detail = target.matches('details') ? target : target.closest('details');
  if (detail) detail.open = true;
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (link) openLinkedDetail(link.getAttribute('href'));
});
window.addEventListener('hashchange', () => openLinkedDetail(window.location.hash));
openLinkedDetail(window.location.hash);

if ('IntersectionObserver' in window) {
  const activeSection = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of navigation.querySelectorAll('a[href^="#"]')) {
        if (link.getAttribute('href') === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-15% 0px -65% 0px' });
  document.querySelectorAll('main > section[id]').forEach(section => activeSection.observe(section));
  if (!reducedMotion.matches) {
    const reveals = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('reveal-pending');
        entry.target.classList.add('reveal-visible');
        reveals.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px 30px 0px', threshold: 0.05 });
    for (const element of document.querySelectorAll('.experience-story, .experience-card, .reel-feature, .education-grid > article, .fashion-grid > figure, .about-heading, .childhood-mount, .about-biography, .family-now-photo')) {
      if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add('reveal-pending');
      reveals.observe(element);
    }
    reducedMotion.addEventListener('change', event => {
      if (event.matches) document.querySelectorAll('.reveal-pending').forEach(el => el.classList.remove('reveal-pending'));
    });
  }
}
const progress = document.querySelector('.reading-progress');
let progressQueued = false;
function updateProgress() {
  const length = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = length > 0 ? Math.min(1, Math.max(0, window.scrollY / length)) : 0;
  progress.style.transform = 'scaleX(' + ratio + ')';
  progressQueued = false;
}
function queueProgress() {
  if (progressQueued) return;
  progressQueued = true;
  requestAnimationFrame(updateProgress);
}
window.addEventListener('scroll', queueProgress, { passive: true });
window.addEventListener('resize', queueProgress);
window.addEventListener('load', queueProgress);
document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', queueProgress));
queueProgress();

// Mount archive posts only when opened, and unload them on close to stop playback.
// Direct source links remain available even when an embed cannot be displayed.
function mountInstagramPost(slot) {
  const url = slot.dataset.instagramUrl;
  let post;
  try { post = new URL(url); } catch { return; }
  if (post.protocol !== 'https:' || !['www.instagram.com', 'instagram.com'].includes(post.hostname)) return;
  const match = post.pathname.match(/^\/(reel|p)\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) return;
  const canonical = 'https://www.instagram.com/' + match[1] + '/' + match[2] + '/';
  const frame = document.createElement('iframe');
  frame.src = canonical + 'embed/';
  frame.title = slot.dataset.videoTitle;
  frame.loading = 'lazy';
  frame.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  slot.replaceChildren(frame);
  slot.classList.add('has-embed');
}
for (const entry of document.querySelectorAll('.video-entry')) {
  const slot = entry.querySelector('.video-slot');
  entry.addEventListener('toggle', () => {
    if (entry.open) {
      if (!slot.querySelector('iframe')) mountInstagramPost(slot);
    } else {
      slot.replaceChildren();
      slot.classList.remove('has-embed');
    }
    queueProgress();
  });
  if (entry.open) mountInstagramPost(slot);
}
