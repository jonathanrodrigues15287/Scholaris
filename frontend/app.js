document.addEventListener('DOMContentLoaded', () => {
  // Theme Toggling Logic
  const themeBtn = document.getElementById('theme-btn');
  const body = document.body;
  const icon = themeBtn.querySelector('i');

  themeBtn.addEventListener('click', () => {
    if (body.getAttribute('data-theme') === 'dark') {
      body.setAttribute('data-theme', 'light');
      icon.className = 'ph-fill ph-moon';
    } else {
      body.setAttribute('data-theme', 'dark');
      icon.className = 'ph ph-sun';
    }
  });

  // Navigation Logic
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      // Remove active class from all links
      navLinks.forEach(l => l.classList.remove('active'));
      // Add active class to clicked link
      e.currentTarget.classList.add('active');

      // Get target section id
      const targetId = e.currentTarget.getAttribute('data-target');

      // Hide all sections
      sections.forEach(sec => sec.classList.remove('active'));
      
      // Show target section
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add('active');
      }
    });
  });
});
