// CV1.E11.S5 cutover: sidebar removed; this file used to carry
// sidebar toggle/collapse helpers + sidebar group expand/collapse +
// the budget banner + composed-drawer + map-card-preview truncation.
// Sidebar bits gone — only the live concerns remain.

document.addEventListener("DOMContentLoaded", function () {
  // Cognitive Map: detect when a card preview is truncated and
  // tag it so the CSS reveals a "read more" affordance.
  document.querySelectorAll(".map-card-preview").forEach(function (el) {
    if (el.scrollHeight > el.clientHeight + 1) {
      el.classList.add("is-truncated");
    }
  });

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
