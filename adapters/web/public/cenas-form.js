// CV1.E11.S7 — Cena form client behavior.
// P3: voice mutex toggle (Persona ↔ Voz da Alma hides Elenco).
// P4: autocomplete + stub-first inline sub-creation.
(function () {
  document.body.classList.add("js-on");

  const form = document.querySelector("[data-cena-form]");
  if (!form) return;

  // --- Voice mutex (P3) ----------------------------------------------------

  const elencoFieldset = form.querySelector("[data-cena-elenco-fieldset]");
  const voiceRadios = form.querySelectorAll("[data-cena-voice]");

  function syncElencoVisibility() {
    const checked = form.querySelector("[data-cena-voice]:checked");
    if (!checked || !elencoFieldset) return;
    if (checked.value === "alma") {
      elencoFieldset.setAttribute("hidden", "");
      const input = elencoFieldset.querySelector('input[name="personas"]');
      if (input) input.value = "";
    } else {
      elencoFieldset.removeAttribute("hidden");
    }
  }

  voiceRadios.forEach((radio) => {
    radio.addEventListener("change", syncElencoVisibility);
  });
  syncElencoVisibility();

  // --- Inventory (P4) ------------------------------------------------------

  const inventoryNode = document.getElementById("cenas-form-inventory");
  let inventory = { personas: [], organizations: [], journeys: [] };
  if (inventoryNode) {
    try {
      inventory = JSON.parse(inventoryNode.textContent || "{}");
    } catch (err) {
      console.error("[cenas-form] failed to parse inventory", err);
    }
  }

  // Local additions during the session — sub-creation results land here so
  // a freshly-created stub immediately shows up in autocomplete (the user
  // doesn't need to refresh).
  function addToInventory(kind, entry) {
    const bucket =
      kind === "persona"
        ? inventory.personas
        : kind === "organization"
          ? inventory.organizations
          : inventory.journeys;
    if (!bucket.some((e) => e.key === entry.key)) bucket.push(entry);
  }

  function inventoryFor(kind) {
    if (kind === "persona") return inventory.personas;
    if (kind === "organization") return inventory.organizations;
    return inventory.journeys;
  }

  // --- Autocomplete (P4) ---------------------------------------------------

  const wraps = form.querySelectorAll("[data-cena-suggest]");
  wraps.forEach(setupAutocomplete);

  function setupAutocomplete(wrap) {
    const kind = wrap.getAttribute("data-cena-suggest");
    const input = wrap.querySelector("input[type='text']");
    const list = wrap.querySelector(".cena-suggest-list");
    const stub = wrap.querySelector("[data-cena-substub]");
    if (!input || !list) return;

    const isMulti = kind === "persona";

    let selectedIdx = -1;

    function currentToken() {
      if (!isMulti) return input.value.trim();
      const parts = input.value.split(",");
      return parts[parts.length - 1].trim();
    }

    function replaceLastToken(value) {
      if (!isMulti) {
        input.value = value;
        return;
      }
      const parts = input.value.split(",").map((p) => p.trim());
      parts[parts.length - 1] = value;
      // Drop empty tokens, dedupe, normalize commas with single space.
      const seen = new Set();
      const cleaned = parts.filter((p) => {
        if (!p) return false;
        if (seen.has(p)) return false;
        seen.add(p);
        return true;
      });
      input.value = cleaned.join(", ");
    }

    function render() {
      const token = currentToken();
      const items = inventoryFor(kind);
      const matches = token
        ? items.filter(
            (it) =>
              it.key.toLowerCase().includes(token.toLowerCase()) ||
              it.name.toLowerCase().includes(token.toLowerCase()),
          )
        : items.slice(0, 8);

      list.innerHTML = "";
      matches.slice(0, 8).forEach((m, i) => {
        const li = document.createElement("li");
        li.dataset.key = m.key;
        li.textContent = m.name === m.key ? m.key : `${m.name} · ${m.key}`;
        li.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          replaceLastToken(m.key);
          hideList();
          input.focus();
        });
        list.appendChild(li);
      });

      // "Create" option — only when the token is non-empty AND no exact key match.
      const exact = items.some(
        (it) => it.key === token || it.name === token,
      );
      if (token && !exact) {
        const li = document.createElement("li");
        li.className = "create-option";
        li.dataset.action = "create";
        li.textContent = `+ ${creationLabel(kind, token)}`;
        li.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          openStub(token);
          hideList();
        });
        list.appendChild(li);
      }

      list.hidden = list.children.length === 0;
      selectedIdx = -1;
    }

    function hideList() {
      list.hidden = true;
      selectedIdx = -1;
    }

    function creationLabel(kind, name) {
      if (kind === "persona") return `Criar persona "${name}"`;
      if (kind === "organization") return `Criar organização "${name}"`;
      return `Criar travessia "${name}"`;
    }

    input.addEventListener("input", render);
    input.addEventListener("focus", render);
    input.addEventListener("blur", () => {
      // Delay so click on a list item registers first.
      setTimeout(hideList, 150);
    });

    // Keyboard nav within the suggest list.
    input.addEventListener("keydown", (ev) => {
      if (list.hidden) return;
      const items = list.querySelectorAll("li");
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
        items.forEach((el, i) => el.classList.toggle("selected", i === selectedIdx));
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        selectedIdx = Math.max(selectedIdx - 1, 0);
        items.forEach((el, i) => el.classList.toggle("selected", i === selectedIdx));
      } else if (ev.key === "Enter" && selectedIdx >= 0) {
        ev.preventDefault();
        items[selectedIdx].dispatchEvent(new MouseEvent("mousedown"));
      } else if (ev.key === "Escape") {
        hideList();
      }
    });

    // --- Stub mini-form ---
    if (!stub) return;

    const stubName = stub.querySelector('[data-stub-field="name"]');
    const stubKey = stub.querySelector('[data-stub-field="key"]');
    const stubDesc = stub.querySelector('[data-stub-field="description"]');
    const stubSave = stub.querySelector('[data-stub-action="save"]');
    const stubCancel = stub.querySelector('[data-stub-action="cancel"]');
    const stubError = stub.querySelector("[data-stub-error]");

    function openStub(initialName) {
      stub.removeAttribute("hidden");
      stubName.value = initialName;
      stubKey.value = slugifyForKey(initialName);
      stubDesc.value = "";
      stubError.hidden = true;
      stubName.focus();
    }

    function closeStub() {
      stub.setAttribute("hidden", "");
      stubError.hidden = true;
    }

    stubName.addEventListener("input", () => {
      // Auto-derive key while the user hasn't manually edited the key field.
      if (!stubKey.dataset.touched) {
        stubKey.value = slugifyForKey(stubName.value);
      }
    });
    stubKey.addEventListener("input", () => {
      stubKey.dataset.touched = "1";
    });

    stubCancel.addEventListener("click", closeStub);

    stubSave.addEventListener("click", async () => {
      stubError.hidden = true;
      const payload = {
        name: stubName.value.trim(),
        key: stubKey.value.trim(),
        description: stubDesc.value.trim(),
      };
      if (!payload.name || !payload.key) {
        stubError.textContent = "Nome e key são obrigatórios.";
        stubError.hidden = false;
        return;
      }
      stubSave.disabled = true;
      try {
        const res = await fetch(`/cenas/sub/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          stubError.textContent = json.error || `Erro ${res.status}`;
          stubError.hidden = false;
          return;
        }
        addToInventory(kind, { key: json.key, name: json.name });
        replaceLastToken(json.key);
        closeStub();
        // Clear the touched marker so the next stub re-derives the key.
        delete stubKey.dataset.touched;
      } catch (err) {
        stubError.textContent = "Falha de rede. Tente novamente.";
        stubError.hidden = false;
      } finally {
        stubSave.disabled = false;
      }
    });
  }

  function slugifyForKey(s) {
    return s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // --- beforeunload (P3) ---------------------------------------------------

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
