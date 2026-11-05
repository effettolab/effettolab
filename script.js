(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const navLinks = document.querySelectorAll('.main-nav a');

  menuButton?.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded));
    menuButton.classList.toggle('is-open', !expanded);
    nav.classList.toggle('is-open', !expanded);
  });

  navLinks.forEach(link => link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.classList.remove('is-open');
    nav?.classList.remove('is-open');
  }));

  // Reveal sections as they enter the viewport; content remains visible without JS.
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add('is-visible'));
  }

  // Portfolio filters.
  const filterButtons = document.querySelectorAll('.filter-btn');
  const workCards = document.querySelectorAll('.work-card');
  filterButtons.forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach(item => item.classList.toggle('is-active', item === button));
    workCards.forEach(card => {
      const matches = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('is-hidden', !matches);
    });
  }));

  // Simple gallery lightbox with keyboard controls.
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = lightbox?.querySelector('img');
  const lightboxCount = lightbox?.querySelector('.lightbox-count');
  const galleryLinks = [...document.querySelectorAll('[data-lightbox="gallery"]')];
  let currentImage = 0;
  const showImage = index => {
    currentImage = (index + galleryLinks.length) % galleryLinks.length;
    const link = galleryLinks[currentImage];
    lightboxImage.src = link.href;
    lightboxImage.alt = link.querySelector('img')?.alt || 'Fotografía de trabajo de Effetto Lab';
    lightboxCount.textContent = `${String(currentImage + 1).padStart(2, '0')} / ${String(galleryLinks.length).padStart(2, '0')}`;
  };
  const closeLightbox = () => {
    lightbox?.classList.remove('is-open');
    document.body.style.overflow = '';
  };
  galleryLinks.forEach((link, index) => link.addEventListener('click', event => {
    event.preventDefault();
    showImage(index);
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }));
  lightbox?.querySelector('.lightbox-close')?.addEventListener('click', closeLightbox);
  lightbox?.querySelector('.lightbox-prev')?.addEventListener('click', () => showImage(currentImage - 1));
  lightbox?.querySelector('.lightbox-next')?.addEventListener('click', () => showImage(currentImage + 1));
  lightbox?.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', event => {
    if (!lightbox?.classList.contains('is-open')) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showImage(currentImage - 1);
    if (event.key === 'ArrowRight') showImage(currentImage + 1);
  });

  // Form opens WhatsApp with the visitor's details; no third-party form backend is required.
  const form = document.getElementById('quick-form');
  const formNote = document.getElementById('form-note');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const service = String(data.get('service') || '').trim();
    const message = String(data.get('message') || '').trim();
    const text = `Hola Effetto Lab, soy ${name}. Me interesa: ${service}.${message ? `\n\nMás detalles: ${message}` : ''}`;
    const url = `https://wa.me/18293731622?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (formNote) formNote.textContent = 'WhatsApp se abrió con tu mensaje preparado.';
  });

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
