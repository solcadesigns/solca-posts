// Solca · website behavior

// 1. Smooth scroll for in-page anchors
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#' || id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', id);
  });
});

// 2. Close other open <details> when one is opened (FAQ accordion behavior)
document.querySelectorAll('.faq-item').forEach(item => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    document.querySelectorAll('.faq-item').forEach(other => {
      if (other !== item) other.open = false;
    });
  });
});

// 3. Highlight nav link based on scroll position (lightweight)
const sections = ['libros', 'guia-gratis', 'videos', 'sobre'].map(id => ({
  id, el: document.getElementById(id)
})).filter(x => x.el);

const navLinks = document.querySelectorAll('.nav-links a');

if (sections.length && navLinks.length) {
  let current = '';
  const onScroll = () => {
    const y = window.scrollY + 100;
    let next = '';
    sections.forEach(s => {
      if (s.el.offsetTop <= y) next = s.id;
    });
    if (next !== current) {
      current = next;
      navLinks.forEach(a => {
        const matches = a.getAttribute('href') === '#' + current;
        a.style.color = matches ? '#F7F5EE' : '';
      });
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}
