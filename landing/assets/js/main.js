// ShareMyBill landing — small progressive-enhancement helpers
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle')
  const nav = document.querySelector('.site-nav')

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open')
      toggle.setAttribute('aria-expanded', String(open))
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
    })
    nav.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open')
        toggle.setAttribute('aria-expanded', 'false')
        toggle.setAttribute('aria-label', 'Open menu')
      }
    })
  }

  const year = document.querySelector('[data-year]')
  if (year) year.textContent = String(new Date().getFullYear())

  if ('IntersectionObserver' in window) {
    const cards = document.querySelectorAll('.card, .steps li, .split, .faq-cta')
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('visible')
          io.unobserve(en.target)
        }
      }
    }, { threshold: 0.12 })
    cards.forEach((c) => {
      c.classList.add('reveal')
      io.observe(c)
    })
  }
})