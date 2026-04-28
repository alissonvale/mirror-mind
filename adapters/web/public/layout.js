window.toggleSidebar = function () {
  var mobile = window.matchMedia("(max-width: 768px)").matches;
  document.body.classList.toggle(mobile ? "sidebar-open" : "sidebar-collapsed");
};

// On mobile, dismiss the open sidebar when the user taps anywhere outside
// it. The toggle button is excluded so its own click doesn't immediately
// close what it just opened. Desktop has no overlay behavior — the
// sidebar is part of the layout, not a transient surface.
document.addEventListener("click", function (e) {
  if (!window.matchMedia("(max-width: 768px)").matches) return;
  if (!document.body.classList.contains("sidebar-open")) return;
  var sidebar = document.querySelector(".sidebar");
  var toggle = document.querySelector(".sidebar-toggle");
  if (sidebar && sidebar.contains(e.target)) return;
  if (toggle && toggle.contains(e.target)) return;
  document.body.classList.remove("sidebar-open");
});

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".map-card-preview").forEach(function (el) {
    if (el.scrollHeight > el.clientHeight + 1) {
      el.classList.add("is-truncated");
    }
  });

  // Sidebar group collapse/expand. Each toggle button carries a
  // data-toggle="<name>" matching the aria-controls target; the expanded
  // state is persisted per-group in localStorage so the user's layout
  // survives page reloads. Default (no stored value) is expanded.
  document.querySelectorAll("[data-toggle]").forEach(function (btn) {
    var name = btn.getAttribute("data-toggle");
    var subsId = btn.getAttribute("aria-controls");
    var subs = subsId ? document.getElementById(subsId) : null;
    if (!name || !subs) return;
    var storageKey = "sidebar-group-" + name;
    var stored = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch (_) {
      // localStorage can be unavailable (private mode on some browsers,
      // disabled by policy); silently degrade to always-expanded.
    }
    // Default to collapsed when the user hasn't expressed a preference yet
    // — keeps the sidebar quiet on first encounter; users who routinely
    // navigate journeys/orgs will open them once and the choice sticks.
    var expanded = stored === "open";
    applyState(btn, subs, expanded);
    btn.addEventListener("click", function () {
      var next = btn.getAttribute("aria-expanded") !== "true";
      applyState(btn, subs, next);
      try {
        window.localStorage.setItem(storageKey, next ? "open" : "closed");
      } catch (_) {
        // ignore
      }
    });
  });

  function applyState(btn, subs, expanded) {
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (expanded) {
      subs.removeAttribute("hidden");
    } else {
      subs.setAttribute("hidden", "");
    }
  }

  // Low-balance banner — admin only. The banner placeholder is injected by
  // Layout for admin users (see layout.tsx). Fetch the JSON status and
  // render a soft alert when credits are under 20%.
  var banner = document.getElementById("budget-alert-banner");
  if (banner) {
    fetch("/admin/budget-alert.json", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.alert) return;
        var pct = Math.round(data.alert.pct);
        var usd = "$" + data.alert.remaining_usd.toFixed(2);
        var brl = data.alert.show_brl && data.alert.remaining_brl !== null
          ? " · R$" + data.alert.remaining_brl.toFixed(2)
          : "";
        banner.innerHTML =
          '<div class="budget-alert-inner">' +
          '<strong>Low balance: ' + pct + '% left</strong> ' +
          '<span class="budget-alert-amount">(' + usd + brl + ')</span> ' +
          '<a href="https://openrouter.ai/settings/credits" target="_blank" rel="noopener noreferrer">Top up →</a>' +
          " · " +
          '<a href="/admin/budget">See details</a>' +
          '</div>';
        banner.classList.add("is-active");
      })
      .catch(function () {
        // Silent — the banner simply doesn't appear if the endpoint errors.
      });
  }

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
