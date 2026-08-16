/* Lightweight Framer-Motion-style FadeIn: whileInView, once:true, margin:50px, amount:0. */
const fadeItems = document.querySelectorAll('.fade-in');
const fadeObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    el.style.setProperty('--fade-x', `${Number(el.dataset.x || 0)}px`);
    el.style.setProperty('--fade-y', `${Number(el.dataset.y ?? 30)}px`);
    el.style.setProperty('--fade-delay', `${Number(el.dataset.delay || 0)}s`);
    el.style.setProperty('--fade-duration', `${Number(el.dataset.duration || .7)}s`);
    el.classList.add('fade-in-ready', 'is-visible');
    observer.unobserve(el);
  });
}, { root: null, rootMargin: '50px', threshold: 0 });
fadeItems.forEach((el) => { el.classList.add('fade-in-ready'); fadeObserver.observe(el); });


const sections = [...document.querySelectorAll('[data-section]')];
const wraps = [...document.querySelectorAll('.section-wrap')];
const dots = [...document.querySelectorAll('.section-dots .dot')];
const navLinks = [...document.querySelectorAll('.nav-links a')];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

/* The browser still owns the page scroll, but visual card properties are
   interpolated every animation frame. This removes the "steppy" feeling
   caused by setting transform/width/height directly on each scroll event. */
const visual = wraps.map(() => ({
  width: 92,
  y: 26,
  scale: .975,
  opacity: 1,
  blur: 0,
  radius: 38
}));

let targetState = wraps.map(() => ({...visual[0]}));
let activeIndex = 0;
let animationFrame = 0;

function getProgress(wrap) {
  const rect = wrap.getBoundingClientRect();
  const vh = window.innerHeight || 1;

  /* Longer, centered travel: 0 when the section is still below,
     1 when its card has comfortably settled. */
  return clamp((vh * .92 - rect.top) / (vh * .92), 0, 1);
}

function computeTargets() {
  const vh = window.innerHeight || 1;
  const scrollY = window.scrollY || 0;

  targetState = wraps.map((wrap, i) => {
    const p = getProgress(wrap);
    const settle = clamp((p - .12) / .88, 0, 1);

    /* Never square the cards. The visual transition is intentionally subtle:
       smaller -> larger, lower -> settled, soft opacity/blur. */
    return {
      width: 88.5 + settle * 3.5,
      y: (1 - settle) * 34,
      scale: .965 + settle * .035,
      opacity: .985 + settle * .015,
      blur: (1 - settle) * .18,
      radius: 44
    };
  });

  /* Previous card recedes only while the next card is actually entering.
     This keeps the overlap smooth rather than abruptly dimming the page. */
  wraps.forEach((wrap, i) => {
    if (i === wraps.length - 1) return;
    const nextP = getProgress(wraps[i + 1]);
    const cover = clamp((nextP - .18) / .82, 0, 1);

    if (cover > 0) {
      targetState[i].scale = lerp(targetState[i].scale, .985, cover);
      targetState[i].opacity = lerp(targetState[i].opacity, .86, cover);
      targetState[i].blur = lerp(targetState[i].blur, .55, cover);
    }
  });

  /* Determine active section from the card whose top is closest to the
     safe visual center. */
  let best = 0;
  let bestDistance = Infinity;
  wraps.forEach((wrap, i) => {
    const rect = wrap.getBoundingClientRect();
    const distance = Math.abs(rect.top - vh * .16);
    if (rect.top < vh * .62 && distance < bestDistance) {
      best = i + 1;
      bestDistance = distance;
    }
  });
  if (scrollY < vh * .38) best = 0;
  activeIndex = best;
}

function renderFrame() {
  let needsMore = false;

  wraps.forEach((wrap, i) => {
    const card = wrap.querySelector('.card');
    if (!card) return;

    const s = visual[i];
    const t = targetState[i] || s;

    const speed = reduceMotion ? 1 : .14;
    s.width = lerp(s.width, t.width, speed);
    s.y = lerp(s.y, t.y, speed);
    s.scale = lerp(s.scale, t.scale, speed);
    s.opacity = lerp(s.opacity, t.opacity, speed);
    s.blur = lerp(s.blur, t.blur, speed);
    s.radius = lerp(s.radius, t.radius, speed);

    if (
      Math.abs(s.width-t.width)>.02 ||
      Math.abs(s.y-t.y)>.02 ||
      Math.abs(s.scale-t.scale)>.0002 ||
      Math.abs(s.opacity-t.opacity)>.001
    ) needsMore = true;

    card.style.width = `${s.width}%`;
    card.style.transform = `translate3d(0, ${s.y}px, 0) scale(${s.scale})`;
    card.style.opacity = `${s.opacity}`;
    card.style.filter = `blur(${s.blur}px)`;
    card.style.borderRadius = `${s.radius}px`;
  });

  dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIndex));
  navLinks.forEach((link) => {
    const target = document.querySelector(link.getAttribute('href'));
    const targetIndex = target ? Number(target.dataset.section) : -1;
    link.classList.toggle('active', targetIndex === activeIndex);
  });

  animationFrame = needsMore ? requestAnimationFrame(renderFrame) : 0;
}


/*
 * Mobile card sizing:
 * Keep the card itself content-height so iPhones do not show a huge empty
 * interior, but give each wrapper a measured scroll runway so the existing
 * cinematic card hand-off animation is preserved.
 */
function sizeMobileSectionRunways() {
  const isMobile = window.innerWidth <= 600;
  wraps.forEach((wrap) => {
    const card = wrap.querySelector('.card');
    if (!card) return;

    if (!isMobile) {
      wrap.style.height = '';
      return;
    }

    const contentHeight = card.scrollHeight;

    // The final Contact section has no following section to transition into.
    // Give it no artificial runway, otherwise the card can finish underneath
    // or too close to the footer on small iPhone viewports.
    if (wrap.dataset.index === '6' || card.classList.contains('contact-card')) {
      wrap.style.height = `${contentHeight}px`;
      return;
    }

    const runway = Math.max(220, Math.min(window.innerHeight * 0.58, 430));
    wrap.style.height = `${contentHeight + runway}px`;
  });
}

function requestSceneUpdate() {
  sizeMobileSectionRunways();
  computeTargets();
  if (!animationFrame) animationFrame = requestAnimationFrame(renderFrame);
}

window.addEventListener('scroll', requestSceneUpdate, {passive:true});
window.addEventListener('resize', requestSceneUpdate);
window.addEventListener('orientationchange', () => setTimeout(requestSceneUpdate, 80));

function goToIndex(index) {
  if (index <= 0) {
    window.scrollTo({top:0, behavior:reduceMotion ? 'auto' : 'smooth'});
    return;
  }
  const wrap = wraps[index - 1];
  if (wrap) {
    window.scrollTo({
      top: wrap.offsetTop + Math.min(window.innerHeight * .08, 90),
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }
}

dots.forEach((dot) => {
  dot.addEventListener('click', () => goToIndex(Number(dot.dataset.to)));
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    const index = Number(target.dataset.section || 0);
    goToIndex(index);
  });
});

/* Initial render */
sizeMobileSectionRunways();
computeTargets();
renderFrame();
