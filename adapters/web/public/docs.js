(() => {
  const STORAGE_KEY = "mirror.docs.navCollapsed";
  const shell = document.getElementById("docs-shell");
  const toggle = document.getElementById("docs-nav-toggle");
  if (!shell || !toggle) return;

  function applyState(collapsed) {
    if (collapsed) {
      shell.classList.add("docs-nav-collapsed");
    } else {
      shell.classList.remove("docs-nav-collapsed");
    }
  }

  // Default state is collapsed (server rendered that way). Only expand if
  // the user has explicitly chosen "expanded" in a previous visit.
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "false") applyState(false);

  toggle.addEventListener("click", () => {
    const next = !shell.classList.contains("docs-nav-collapsed");
    applyState(next);
    localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
  });
})();
