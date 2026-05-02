// CV1.E11.S2 — Avatar top bar dropdown toggle.
(function () {
  const toggles = document.querySelectorAll("[data-avatar-toggle]");
  if (!toggles.length) return;

  toggles.forEach((toggle) => {
    const dropdown = toggle.parentElement?.querySelector(
      "[data-avatar-dropdown]",
    );
    if (!dropdown) return;

    toggle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const isHidden = dropdown.hasAttribute("hidden");
      if (isHidden) {
        dropdown.removeAttribute("hidden");
        toggle.setAttribute("aria-expanded", "true");
      } else {
        dropdown.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("click", (ev) => {
      if (!toggle.parentElement?.contains(ev.target)) {
        dropdown.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        dropdown.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  });
})();
