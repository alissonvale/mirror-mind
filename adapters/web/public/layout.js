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

  // Composed-prompt drawer (present on the Cognitive Map page only).
  var drawer = document.querySelector(".composed-drawer");
  if (!drawer) return;

  var endpoint = drawer.dataset.endpoint;
  var content = drawer.querySelector(".composed-drawer-content");
  var personaSelect = document.getElementById("composed-persona");
  var organizationSelect = document.getElementById("composed-organization");
  var journeySelect = document.getElementById("composed-journey");
  var adapterSelect = document.getElementById("composed-adapter");

  function fetchComposed() {
    if (!endpoint || !content) return;
    var persona = personaSelect ? personaSelect.value : "none";
    var organization = organizationSelect ? organizationSelect.value : "none";
    var journey = journeySelect ? journeySelect.value : "none";
    var adapter = adapterSelect ? adapterSelect.value : "none";
    var url =
      endpoint +
      "?persona=" +
      encodeURIComponent(persona) +
      "&organization=" +
      encodeURIComponent(organization) +
      "&journey=" +
      encodeURIComponent(journey) +
      "&adapter=" +
      encodeURIComponent(adapter);
    content.textContent = "Loading…";
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        content.textContent = data.prompt || "(empty composition)";
      })
      .catch(function (err) {
        content.textContent = "[error loading prompt: " + err.message + "]";
      });
  }

  function openDrawer() {
    drawer.setAttribute("data-state", "open");
    fetchComposed();
  }

  function closeDrawer() {
    drawer.setAttribute("data-state", "closed");
  }

  document.querySelectorAll("[data-open-drawer]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      openDrawer();
    });
  });

  document.querySelectorAll("[data-close-drawer]").forEach(function (el) {
    el.addEventListener("click", closeDrawer);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer.getAttribute("data-state") === "open") {
      closeDrawer();
    }
  });

  if (personaSelect) personaSelect.addEventListener("change", fetchComposed);
  if (organizationSelect)
    organizationSelect.addEventListener("change", fetchComposed);
  if (journeySelect) journeySelect.addEventListener("change", fetchComposed);
  if (adapterSelect) adapterSelect.addEventListener("change", fetchComposed);
});
