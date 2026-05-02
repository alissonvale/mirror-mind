// CV1.E11.S7 — Cena form client behavior.
// P3 ships only the voice mutex toggle (Persona ↔ Voz da Alma hides
// the Elenco fieldset). P4 will add autocomplete + stub-first
// inline sub-creation.
(function () {
  document.body.classList.add("js-on");

  const form = document.querySelector("[data-cena-form]");
  if (!form) return;

  const elencoFieldset = form.querySelector("[data-cena-elenco-fieldset]");
  const voiceRadios = form.querySelectorAll("[data-cena-voice]");

  function syncElencoVisibility() {
    const checked = form.querySelector("[data-cena-voice]:checked");
    if (!checked || !elencoFieldset) return;
    if (checked.value === "alma") {
      elencoFieldset.setAttribute("hidden", "");
      // Clear the input so a flip-to-Alma + save doesn't carry stale
      // personas through to the server (server-side mutex would catch
      // it anyway, but this keeps the form state honest).
      const input = elencoFieldset.querySelector('input[name="personas"]');
      if (input) input.value = "";
    } else {
      elencoFieldset.removeAttribute("hidden");
    }
  }

  voiceRadios.forEach((radio) => {
    radio.addEventListener("change", syncElencoVisibility);
  });

  // Initial sync — defends against SSR/JS state drift on F5.
  syncElencoVisibility();

  // beforeunload — warn the user about losing in-progress work.
  // Triggers only after the form has been touched. Suppressed when
  // the user actually submits (form's submit listener clears the flag).
  let dirty = false;
  form.addEventListener("input", () => {
    dirty = true;
  });
  form.addEventListener("submit", () => {
    dirty = false;
  });
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
})();
