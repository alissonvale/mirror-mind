window.toggleSidebar = function () {
  var mobile = window.matchMedia("(max-width: 768px)").matches;
  document.body.classList.toggle(mobile ? "sidebar-open" : "sidebar-collapsed");
};

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".map-card-preview").forEach(function (el) {
    if (el.scrollHeight > el.clientHeight + 1) {
      el.classList.add("is-truncated");
    }
  });
});
