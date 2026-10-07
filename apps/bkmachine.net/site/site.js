(() => {
  const root = document.documentElement;
  root.classList.add('js');

  // Solid header once the page scrolls past the top of the hero.
  const header = document.querySelector('[data-header]');
  const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  // Mobile navigation.
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  const setNavOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    if (open) header.classList.add('is-scrolled');
    else updateHeader();
  };
  toggle.addEventListener('click', () => {
    setNavOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setNavOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setNavOpen(false);
  });

 // Hero photo slider.
  const slider = document.querySelector('[data-slider]');
  if (slider) {
    const slides = [...slider.querySelectorAll('.hero__slide')];
    const dots = slider.querySelector('[data-slider-dots]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    let timer;
    const show = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === current);
        slide.setAttribute('aria-hidden', String(i !== current));
      });
      [...dots.children].forEach((dot, i) => {
        dot.setAttribute('aria-current', String(i === current));
      });
    };
    const start = () => {
      if (reduced) return;
      clearInterval(timer);
      timer = setInterval(() => show(current + 1), 5000);
    };
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show photo ${i + 1}`);
      dot.addEventListener('click', () => {
        show(i);
        start();
      });
      dots.append(dot);
    });
    slider.addEventListener('mouseenter', () => clearInterval(timer));
    slider.addEventListener('mouseleave', start);
    show(0);
    start();
  }

  // Fade sections in as they enter the viewport.
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    for (const item of revealItems) observer.observe(item);
  } else {
    for (const item of revealItems) item.classList.add('is-visible');
  }

  // There is no form backend, so the quote form composes an email instead.
  const form = document.querySelector('[data-quote-form]');
  const formError = document.querySelector('[data-form-error]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const value = (key) => String(data.get(key) ?? '').trim();

    const emailValid = form.elements.email.checkValidity() && value('email');
    if (!value('name') || !emailValid) {
      formError.hidden = false;
      (value('name') ? form.elements.email : form.elements.name).focus();
      return;
    }
    formError.hidden = true;

    const lines = [
      ['Name', value('name')],
      ['Company', value('company')],
      ['Email', value('email')],
      ['Phone', value('phone')],
      ['Quantity', value('quantity')],
      ['Material', value('material')],
    ]
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    const body = [...lines, '', value('details')].join('\n');
    const subject = `Quote request${value('company') ? ` - ${value('company')}` : ''}`;
    window.location.href = `mailto:jeff@bkmachine.net?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
