// nav.js — section switching and mobile collapsible sidebar

(function () {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const overlay = document.getElementById('sidebar-overlay');

  function switchSection(targetId) {
    navLinks.forEach(l => l.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    document.querySelector(`[data-target="${targetId}"]`)?.classList.add('active');
    document.getElementById(targetId)?.classList.add('active');
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      switchSection(link.getAttribute('data-target'));
      closeSidebar(); // auto-close on mobile after tap
    });
  });

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
  }

  hamburgerBtn?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });

  overlay?.addEventListener('click', closeSidebar);
})();
