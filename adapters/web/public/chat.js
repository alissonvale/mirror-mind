const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const messages = document.getElementById("messages");
const sendBtn = form.querySelector("button");

// --- Context Rail ---

const rail = document.getElementById("context-rail");

// CV1.E7.S2 follow-up: rail is admin-only, hidden by default, toggled
// by elements marked [data-toggle="rail"] (the header menu's "Look
// inside" item + the rail's own close ×). Visibility persists across
// reloads via localStorage.
const RAIL_VISIBLE_KEY = "mirror.rail.visible";
if (rail) {
  const stored = localStorage.getItem(RAIL_VISIBLE_KEY) === "true";
  rail.setAttribute("data-visible", stored ? "true" : "false");

  const toggle = () => {
    const next = rail.getAttribute("data-visible") !== "true";
    rail.setAttribute("data-visible", next ? "true" : "false");
    localStorage.setItem(RAIL_VISIBLE_KEY, next ? "true" : "false");
  };

  document.querySelectorAll('[data-toggle="rail"]').forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      toggle();
      // Close the containing <details> so the menu/close button
      // doesn't hang open around the toggled rail.
      const parent = el.closest("details");
      if (parent) parent.removeAttribute("open");
    });
  });
}

// CV1.E7.S2 follow-up: click-outside-to-close for every native
// <details> popover in the conversation UI. Covers:
//   - header-menu (⋯)
//   - header-cast-avatar-wrap (persona popover)
//   - header-cast-add (+ persona picker)
//   - header-scope-overflow (+N more)
//   - header-scope-add (+ org / + journey pickers)
//   - header-mode-pouch (segmented control)
//
// Native <details> only closes on its own <summary> click; clicking
// elsewhere on the page leaves it open. This listener walks the open
// <details> elements on every document click and closes any whose
// ancestor doesn't contain the click target.
document.addEventListener("click", (e) => {
  const opened = document.querySelectorAll("details[open]");
  opened.forEach((det) => {
    if (!det.contains(e.target)) {
      det.removeAttribute("open");
    }
  });
});

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatTokens(n) {
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k tokens`;
  return `~${n} tokens`;
}

function formatBRL(n) {
  return `R$ ${n.toFixed(4).replace(".", ",")}`;
}

function formatUSD(n) {
  return `$ ${n.toFixed(4)}`;
}

function applyAvatarStyle(id, color, empty) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.background = color;
  el.setAttribute("data-empty", empty ? "true" : "false");
}

function setCost(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  const costBRL = state.sessionStats.costBRL;
  const showCost = state.showCost !== false; // default true if undefined
  const showBrl = state.showBrl !== false;
  const rate = state.usdToBrlRate > 0 ? state.usdToBrlRate : 5;
  if (showCost && costBRL !== null) {
    el.textContent = showBrl
      ? formatBRL(costBRL)
      : formatUSD(costBRL / rate);
    el.setAttribute("data-hidden", "false");
  } else {
    el.textContent = "";
    el.setAttribute("data-hidden", "true");
  }
}

function updateRail(state) {
  if (!rail || !state) return;

  const persona = state.composed?.persona ?? null;
  rail.setAttribute("data-persona", persona ?? "");

  // Persona block
  setText("rail-persona-initials", persona ? state.personaInitials : "");
  setText("rail-persona-name", persona ?? "ego");
  setText(
    "rail-persona-descriptor",
    persona ? state.personaDescriptor || "" : "voz base",
  );
  applyAvatarStyle("rail-persona-avatar", state.personaColor, !persona);

  // Session block
  setText("rail-messages", `${state.sessionStats.messages} messages`);
  setText(
    "rail-tokens",
    formatTokens(state.sessionStats.tokensIn + state.sessionStats.tokensOut),
  );
  setCost("rail-cost", state);
  setText("rail-model", state.sessionStats.model);

  // Composed block. CV1.E9 follow-up: hide the whole block when no
  // layers have composed yet — the title alone is noise.
  const composedBlockEl = document.getElementById("rail-composed-block");
  if (composedBlockEl) {
    composedBlockEl.setAttribute(
      "data-empty",
      state.composed.layers.length === 0 ? "true" : "false",
    );
  }
  setText(
    "rail-layers",
    state.composed.layers.length ? state.composed.layers.join(" · ") : "—",
  );
  // CV1.E9.S3: Alma indicator. Persona row stays hidden on Alma turns
  // (composed.persona is null when isAlma is true — server forces it).
  // Toggled here so a turn that flips the rail off Alma → persona (or
  // vice-versa) renders correctly without an F5.
  const composedAlmaEl = document.getElementById("rail-composed-alma");
  if (composedAlmaEl) {
    if (state.composed?.isAlma) {
      composedAlmaEl.textContent = "◈ Voz da Alma";
      composedAlmaEl.setAttribute("data-hidden", "false");
    } else {
      composedAlmaEl.textContent = "";
      composedAlmaEl.setAttribute("data-hidden", "true");
    }
  }
  const composedPersonaEl = document.getElementById("rail-composed-persona");
  if (composedPersonaEl) {
    if (persona) {
      composedPersonaEl.textContent = `◇ ${persona}`;
      composedPersonaEl.setAttribute("data-hidden", "false");
    } else {
      composedPersonaEl.textContent = "";
      composedPersonaEl.setAttribute("data-hidden", "true");
    }
  }
  const organization = state.composed?.organization ?? null;
  const composedOrgEl = document.getElementById("rail-composed-organization");
  if (composedOrgEl) {
    if (organization) {
      composedOrgEl.textContent = `organization: ${organization}`;
      composedOrgEl.setAttribute("data-hidden", "false");
    } else {
      composedOrgEl.textContent = "";
      composedOrgEl.setAttribute("data-hidden", "true");
    }
  }
  const journey = state.composed?.journey ?? null;
  const composedJourneyEl = document.getElementById("rail-composed-journey");
  if (composedJourneyEl) {
    if (journey) {
      composedJourneyEl.textContent = `journey: ${journey}`;
      composedJourneyEl.setAttribute("data-hidden", "false");
    } else {
      composedJourneyEl.textContent = "";
      composedJourneyEl.setAttribute("data-hidden", "true");
    }
  }
  // CV1.E7.S9 phase 2: same pattern for the resolved mode.
  const mode = state.composed?.mode ?? null;
  const composedModeEl = document.getElementById("rail-composed-mode");
  if (composedModeEl) {
    if (mode) {
      composedModeEl.textContent = `mode: ${mode}`;
      composedModeEl.setAttribute("data-hidden", "false");
    } else {
      composedModeEl.textContent = "";
      composedModeEl.setAttribute("data-hidden", "true");
    }
  }

  // Rail collapsed strip + legacy old-rail persona/cost row refs were
  // removed when the rail slimmed to "Look inside" only (CV1.E7.S2
  // follow-up). The updateRail refs above that read #rail-composed-*
  // still land when the admin has the rail open; they no-op otherwise.
}

// --- Lab mode (bypass persona) ---

const LAB_BYPASS_KEY = "mirror.lab.bypassPersona";
const bypassCheckbox = document.getElementById("lab-bypass-persona");

if (bypassCheckbox) {
  bypassCheckbox.checked = localStorage.getItem(LAB_BYPASS_KEY) === "true";
  bypassCheckbox.addEventListener("change", () => {
    localStorage.setItem(LAB_BYPASS_KEY, bypassCheckbox.checked ? "true" : "false");
  });
}

// --- Chat ---

// Lightweight markdown → HTML (no external deps)
function md(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");
  html = html.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, "<em>$1</em>");
  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
  // Paragraphs (double newline)
  html = html.replace(/\n\n/g, "</p><p>");
  html = "<p>" + html + "</p>";
  // Clean empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");
  // Single newlines → br (inside paragraphs, not in pre/lists)
  html = html.replace(/(?<!<\/li>|<\/h[123]>|<\/pre>|<\/ul>)\n(?!<)/g, "<br>");

  return html;
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg msg-${role}`;
  const body = document.createElement("div");
  body.className = "msg-body";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (role === "user") {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = md(text);
  }
  body.appendChild(bubble);
  div.appendChild(body);
  messages.appendChild(div);
  scrollToBottom();
  return div;
}

// CV1.E7 delete-turn: attach the × form + button to a message node.
// Called for both history-rendered messages (server-rendered, just
// enhance hooks) and newly streamed messages after the `done` event.
//
// Anchors the form inside .msg-body so absolute-positioning stays
// relative to the bubble's visual column, not the full-width .msg row
// (which would hide the × behind #messages' overflow-x: hidden).
function attachDeleteForm(msgNode, entryId, sessionId) {
  if (!msgNode || !entryId || !sessionId) return;
  if (msgNode.querySelector(".msg-delete-form")) return; // idempotent
  const body = msgNode.querySelector(".msg-body");
  if (!body) return;
  msgNode.setAttribute("data-entry-id", entryId);
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/conversation/turn/forget";
  form.className = "msg-delete-form";
  form.onsubmit = () =>
    confirm(
      "Delete this exchange? The user message and its reply will be removed from this conversation.",
    );
  const entryInput = document.createElement("input");
  entryInput.type = "hidden";
  entryInput.name = "entryId";
  entryInput.value = entryId;
  const sessionInput = document.createElement("input");
  sessionInput.type = "hidden";
  sessionInput.name = "sessionId";
  sessionInput.value = sessionId;
  const btn = document.createElement("button");
  btn.type = "submit";
  btn.className = "msg-delete-btn";
  btn.setAttribute("aria-label", "Delete this exchange");
  btn.title = "Delete this exchange";
  btn.textContent = "×";
  form.appendChild(entryInput);
  form.appendChild(sessionInput);
  form.appendChild(btn);
  body.appendChild(form);
}

// Render markdown in existing history bubbles
document.querySelectorAll(".msg-assistant .bubble").forEach((b) => {
  b.innerHTML = md(b.textContent || "");
});
// CV1.E7.S8: same pattern for server-rendered divergent sub-bubbles.
// They live inside .msg-body alongside the canonical .bubble; their
// content is plain text from the database and needs the same
// markdown pass to render lists / code / emphasis correctly.
document.querySelectorAll(".divergent-bubble-content").forEach((b) => {
  b.innerHTML = md(b.textContent || "");
});

let streamText = "";

const sessionId = messages.getAttribute("data-session-id") || "";

// Session tag pools — kept in sync on every rail mutation via a full
// page reload, so the dataset read once at boot is accurate for this
// session's lifecycle. Used to suppress per-message badges whose pick
// is already implied by the pool (orgs + journeys only — persona
// badge retired in CV1.E7.S2, replaced by the bubble signature).
function parsePool(attr) {
  const raw = messages.getAttribute(attr) || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
const poolOrganizations = parsePool("data-pool-organizations");
const poolJourneys = parsePool("data-pool-journeys");

// CV1.E7.S2 — persona signature helpers.
// Mirror the TS helpers in context-rail.tsx so streamed bubbles can
// apply the same color bar + mini-avatar as server-rendered ones.
const PERSONA_COLORS = [
  "#b88a6b",
  "#8b7d6b",
  "#8aa08b",
  "#b69b7c",
  "#7c9aa0",
  "#a88b8b",
  "#9a8ba0",
  "#8ba095",
];
function personaColor(name) {
  if (!name) return "#c9c4bd";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PERSONA_COLORS[hash % PERSONA_COLORS.length];
}
function personaInitials(name) {
  if (!name) return "";
  const parts = name.split(/[-_\s]+/).filter(Boolean);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// CV1.E7.S9 phase 1: mirror of the modeIcon helper in mirror.tsx.
// Returns the bubble glyph for compositional / essayistic modes;
// undefined for conversational (the default — silent on purpose so
// presence of a glyph signals "reception escalated above default")
// and for unknown modes. Glyphs match the server-rendered mapping.
function modeIconFromKey(mode) {
  if (mode === "compositional") return "☰";
  if (mode === "essayistic") return "¶";
  return undefined;
}

// Read the last assistant's persona SET from the DOM, skipping the
// node passed in (which is the currently-streaming bubble being
// decorated). CV1.E7.S5: each msg wrapper carries `data-personas`
// (comma-separated). Returns the Set for the most recent preceding
// assistant, or an empty Set when that turn had no persona (a null
// turn resets continuity — the next persona'd turn's entire set
// counts as new).
function lastAssistantPersonaSetInDOM(currentNode) {
  const nodes = messages.querySelectorAll(".msg-assistant");
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i] === currentNode) continue;
    const raw = nodes[i].getAttribute("data-personas") || "";
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      // Legacy data-persona fallback.
      const singular = nodes[i].getAttribute("data-persona") || "";
      return new Set(singular ? [singular] : []);
    }
    return new Set(list);
  }
  return new Set();
}

/**
 * When reception picks a persona on the first turn of a fresh session,
 * the server auto-seeds session_personas (CV1.E4.S4 hybrid model).
 * The DOM of the Cast zone was rendered before that write happened,
 * so the new avatar won't show up without a page reload. This helper
 * inserts a matching avatar into the header as soon as the routing
 * event arrives — idempotent (early-returns if an avatar for that key
 * already exists).
 *
 * The inserted node is a simplified avatar without the <details>
 * popover (descriptor + turn count + dismiss form). The full popover
 * markup returns on the next page load — the server side-render has
 * everything it needs by then. For this session, the user sees the
 * persona show up in the cast immediately, which is the critical bit.
 */
function ensureCastAvatar(personaKey, explicitColor) {
  if (!personaKey) return;
  const list = document.querySelector(".header-cast-list");
  if (!list) return;
  const existing = list.querySelector(
    `[data-persona="${CSS.escape(personaKey)}"]`,
  );
  if (existing) return;
  // Drop the "empty" placeholder if it's still showing.
  const empty = list.querySelector(".header-cast-empty");
  if (empty) empty.remove();
  // Prefer the color that the server sent in the routing event (honors
  // the stored persona.color column). Fall back to the hash.
  const color = explicitColor || personaColor(personaKey);
  const wrap = document.createElement("span");
  wrap.className = "header-cast-avatar-wrap";
  wrap.setAttribute("data-persona", personaKey);
  const avatar = document.createElement("span");
  avatar.className = "header-cast-avatar";
  avatar.style.background = color;
  avatar.setAttribute("title", personaKey);
  avatar.setAttribute("aria-label", personaKey);
  avatar.textContent = personaInitials(personaKey);
  wrap.appendChild(avatar);
  // Insert before the '+' add control if present, otherwise append.
  const addCtrl = list.querySelector(".header-cast-add");
  if (addCtrl) list.insertBefore(wrap, addCtrl);
  else list.appendChild(wrap);
}

/**
 * Symmetric counterpart to ensureCastAvatar — when reception activates
 * an organization or journey on the first turn of a fresh session,
 * the server auto-seeds session_organizations / session_journeys, but
 * the Scope zone of the header was rendered before that write. This
 * helper inserts the missing pill so the hot-update parity matches
 * the Cast.
 *
 * Idempotent: if the key is already in the pool array (which mirrors
 * the server-rendered group), this is a no-op. Otherwise it builds
 * the same form shape as ScopePillGroup's `removeForm`, inserts it
 * before the `+Add` control, removes the "no context" placeholder
 * if present, and pushes the key onto the pool array so subsequent
 * suppression rules (bubble badges hide when the pick is in the pool)
 * stay consistent without a page reload.
 */
function ensureScopePill(type, key) {
  if (!key) return;
  const pool = type === "organization" ? poolOrganizations : poolJourneys;
  if (pool.includes(key)) return;
  const group = document.querySelector(
    `.header-scope-group[data-type="${type}"]`,
  );
  if (!group) return;

  // Drop the "no context" placeholder if it's still rendered (it shows
  // only when both org and journey lists are empty in the server render).
  const list = document.querySelector(".header-scope-list");
  if (list) {
    const empty = list.querySelector(".header-scope-empty");
    if (empty) empty.remove();
  }

  const icon = type === "organization" ? "⌂" : "↝";
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/conversation/untag";
  form.className = "header-scope-pill-form";

  const sid = document.createElement("input");
  sid.type = "hidden";
  sid.name = "sessionId";
  sid.value = sessionId;
  form.appendChild(sid);

  const tp = document.createElement("input");
  tp.type = "hidden";
  tp.name = "type";
  tp.value = type;
  form.appendChild(tp);

  const k = document.createElement("input");
  k.type = "hidden";
  k.name = "key";
  k.value = key;
  form.appendChild(k);

  const iconEl = document.createElement("span");
  iconEl.className = "header-scope-pill-icon";
  iconEl.setAttribute("aria-hidden", "true");
  iconEl.textContent = icon;
  form.appendChild(iconEl);

  const nameEl = document.createElement("span");
  nameEl.className = "header-scope-pill-name";
  // Display name not in the routing payload yet — fall back to the key.
  // Next full server render will replace this with the human-facing name.
  nameEl.textContent = key;
  form.appendChild(nameEl);

  const removeBtn = document.createElement("button");
  removeBtn.type = "submit";
  removeBtn.className = "header-scope-pill-remove";
  removeBtn.setAttribute("aria-label", `Remove ${key}`);
  removeBtn.textContent = "×";
  form.appendChild(removeBtn);

  // Insert before the `+Add` control if present, otherwise append.
  const addCtrl = group.querySelector(".header-scope-add");
  if (addCtrl) group.insertBefore(form, addCtrl);
  else group.appendChild(form);

  // Sync the suppression pool so the bubble badge logic on subsequent
  // turns reads the new tag as "in pool" and skips the divergence badge.
  pool.push(key);
}

// CV1.E7.S8: attach an out-of-pool suggestion card below a streamed
// assistant bubble. Reads the would-have-* data attributes set during
// the routing event; for each non-null value, appends a small card
// with a single button that triggers a divergent run when clicked.
//
// The button posts to /conversation/divergent-run with the parent
// entry id and the override key. On success, the response renders
// inline as a sub-bubble below the canonical bubble (same parent's
// .msg-body), styled distinctly so it reads as a side branch.
function attachOutOfPoolSuggestions(msgNode, parentEntryId, sessionId) {
  if (!msgNode || !parentEntryId) return;
  const body = msgNode.querySelector(".msg-body");
  if (!body) return;
  const persona = msgNode.getAttribute("data-would-have-persona");
  const org = msgNode.getAttribute("data-would-have-organization");
  const journey = msgNode.getAttribute("data-would-have-journey");
  if (!persona && !org && !journey) return;

  const container = document.createElement("div");
  container.className = "out-of-pool-suggestions";
  if (persona) {
    container.appendChild(
      buildSuggestionCard({
        type: "persona",
        key: persona,
        label: `◇ ${persona} may have something to say`,
        actionLabel: "Hear it",
        parentEntryId,
        sessionId,
        msgNode,
      }),
    );
  }
  if (org) {
    container.appendChild(
      buildSuggestionCard({
        type: "organization",
        key: org,
        label: `Add ⌂ ${org} context to this answer?`,
        actionLabel: "Yes",
        parentEntryId,
        sessionId,
        msgNode,
      }),
    );
  }
  if (journey) {
    container.appendChild(
      buildSuggestionCard({
        type: "journey",
        key: journey,
        label: `Add ↝ ${journey} to this answer?`,
        actionLabel: "Yes",
        parentEntryId,
        sessionId,
        msgNode,
      }),
    );
  }
  body.appendChild(container);
}

function buildSuggestionCard({
  type,
  key,
  label,
  actionLabel,
  parentEntryId,
  sessionId,
  msgNode,
}) {
  const card = document.createElement("div");
  card.className = "out-of-pool-card";
  card.setAttribute("data-type", type);
  card.setAttribute("data-key", key);

  const labelEl = document.createElement("span");
  labelEl.className = "out-of-pool-label";
  labelEl.textContent = label;
  card.appendChild(labelEl);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "out-of-pool-action";
  btn.textContent = actionLabel;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Running…";
    try {
      const res = await fetch("/conversation/divergent-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, parentEntryId, type, key }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "request failed");
        btn.disabled = false;
        btn.textContent = actionLabel;
        labelEl.textContent = `Divergent run failed: ${err}`;
        return;
      }
      const data = await res.json();
      card.classList.add("out-of-pool-card-fired");
      btn.remove();
      renderDivergentSubBubble(msgNode, data);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = actionLabel;
      labelEl.textContent = `Error: ${err.message}`;
    }
  });
  card.appendChild(btn);
  return card;
}

// CV1.E7.S8: render the divergent response as a sub-bubble inside the
// parent message's msg-body. Indented, smaller font, with the
// override's badge and (for personas) color bar — visually clear
// that it's a side branch, not the canonical answer.
function renderDivergentSubBubble(msgNode, data) {
  const body = msgNode.querySelector(".msg-body");
  if (!body) return;
  const wrap = document.createElement("div");
  wrap.className = "divergent-bubble";
  wrap.setAttribute("data-divergent-id", data.id);
  wrap.setAttribute("data-override-type", data.overrideType);
  wrap.setAttribute("data-override-key", data.overrideKey);

  const badge = document.createElement("div");
  badge.className = "divergent-badge";
  let icon = "◇";
  if (data.overrideType === "organization") icon = "⌂";
  if (data.overrideType === "journey") icon = "↝";
  badge.textContent = `${icon} ${data.overrideKey} — divergent run`;
  wrap.appendChild(badge);

  const inner = document.createElement("div");
  inner.className = "divergent-bubble-content";
  if (data.overrideType === "persona") {
    const color = personaColor(data.overrideKey);
    inner.style.borderLeft = `3px solid ${color}`;
  }
  inner.innerHTML = md(data.content);
  wrap.appendChild(inner);

  body.appendChild(wrap);
  scrollToBottom();
}

/**
 * CV1.E7.S5: attach the persona signature to a streamed assistant
 * bubble. Accepts an array of personas (zero-or-more); the bubble's
 * color bar uses the primary (first), and one `◇ key` badge is
 * rendered per persona NEW compared to the previous assistant's
 * persona set.
 *
 * Colors is a Record<key, color> — when missing, falls back to the
 * client-side hash helper.
 */
/**
 * CV1.E9: paint a streaming bubble as a Voz da Alma turn — distinct
 * color bar (warm amber) + ◈ badge. Symmetric to attachPersonaSignature
 * but for the Alma path: no persona array, no per-key badges.
 */
function attachAlmaSignature(msgNode) {
  if (!msgNode) return;
  const bubble = msgNode.querySelector(".bubble");
  const badgesEl = msgNode.querySelector(".msg-badges");
  const ALMA_COLOR = "#b8956a";
  if (bubble) bubble.style.borderLeft = `3px solid ${ALMA_COLOR}`;
  msgNode.setAttribute("data-is-alma", "true");
  if (!badgesEl) return;
  // Clear any previous persona badges on the streaming bubble (Alma
  // replaces the persona path; if the bubble was momentarily painted
  // with persona signature before the routing event clarified Alma,
  // wipe the persona badges so the surface stays honest).
  badgesEl
    .querySelectorAll(".msg-badge-persona")
    .forEach((el) => el.remove());
  const badge = document.createElement("span");
  badge.className = "msg-badge msg-badge-alma";
  badge.textContent = "◈ Voz da Alma";
  badge.style.color = ALMA_COLOR;
  badgesEl.insertBefore(badge, badgesEl.firstChild);
  badgesEl.style.display = "";
}

function attachPersonaSignature(msgNode, personas, colorsMap) {
  if (!msgNode || !Array.isArray(personas) || personas.length === 0) return;
  const bubble = msgNode.querySelector(".bubble");
  const badgesEl = msgNode.querySelector(".msg-badges");
  if (!bubble) return;
  const primary = personas[0];
  const primaryColor =
    (colorsMap && colorsMap[primary]) || personaColor(primary);
  bubble.style.borderLeft = `3px solid ${primaryColor}`;
  // Mark the wrapper so the next turn's comparison can read the set.
  msgNode.setAttribute("data-persona", primary);
  msgNode.setAttribute("data-personas", personas.join(","));
  // Text badges: one per persona NEW compared to the previous turn.
  const previous = lastAssistantPersonaSetInDOM(msgNode);
  const newOnes = personas.filter((k) => !previous.has(k));
  if (newOnes.length === 0 || !badgesEl) return;
  // Insert in order at the front of the badges block.
  for (let i = newOnes.length - 1; i >= 0; i--) {
    const key = newOnes[i];
    const color = (colorsMap && colorsMap[key]) || personaColor(key);
    const badge = document.createElement("span");
    badge.className = "msg-badge msg-badge-persona";
    badge.textContent = `◇ ${key}`;
    badge.style.color = color;
    badgesEl.insertBefore(badge, badgesEl.firstChild);
  }
  badgesEl.style.display = "";
}

// CV1.E9.S4: factored from form.submit so the "Enviar Para…" popover
// can drive the same send flow with a forced destination. `forced` is
// either null (canonical reception path), "alma", or "persona:<key>".
async function runSend(text, forced) {
  if (!text) return;

  input.value = "";
  sendBtn.disabled = true;
  if (sendToBtn) sendToBtn.disabled = true;
  streamText = "";

  const userMsgNode = addMessage("user", text);

  const div = document.createElement("div");
  div.className = "msg msg-assistant msg-streaming";
  const badgesEl = document.createElement("div");
  badgesEl.className = "msg-badges";
  badgesEl.style.display = "none";
  // Persona badge retired in CV1.E7.S2 — the bubble signature (color
  // bar + mini-avatar) carries the signal instead. Org and journey
  // badges remain for divergence cases (pick not in pool).
  const organizationBadge = document.createElement("span");
  organizationBadge.className = "msg-badge msg-badge-organization";
  organizationBadge.style.display = "none";
  const journeyBadge = document.createElement("span");
  journeyBadge.className = "msg-badge msg-badge-journey";
  journeyBadge.style.display = "none";
  badgesEl.appendChild(organizationBadge);
  badgesEl.appendChild(journeyBadge);
  const body = document.createElement("div");
  body.className = "msg-body";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  // CV1.E7.S1 two-phase UX: start in the default 'typing' state. The
  // server emits two status events ('composing' → 'finding-voice')
  // before the first delta; each transitions the microtext here.
  bubble.innerHTML =
    '<span class="typing" aria-label="pensando"><span></span><span></span><span></span></span>';
  let statusShown = false;
  div.appendChild(badgesEl);
  body.appendChild(bubble);
  div.appendChild(body);
  messages.appendChild(div);
  scrollToBottom();

  try {
    const bypassPersona = bypassCheckbox?.checked ? "&bypass_persona=true" : "";
    // CV1.E9.S4: append forced_destination when the popover-routed
    // path is engaged. URL-encoded so persona keys with non-trivial
    // characters survive intact.
    const forcedParam = forced
      ? `&forced_destination=${encodeURIComponent(forced)}`
      : "";
    const response = await fetch(
      `/conversation/stream?text=${encodeURIComponent(text)}${bypassPersona}${forcedParam}`,
    );
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        try {
          const event = JSON.parse(payload);
          if (event.type === "routing") {
            // CV1.E7.S2: persona signature replaces the persona badge.
            // Org and journey badges still surface divergences (pick
            // not in pool).
            // CV1.E7.S5: prefer the plural shape (personas + personaColors)
            // emitted by the server. Legacy singular payload falls back
            // to a one-element array for compat.
            const personasForEvent = Array.isArray(event.personas)
              ? event.personas
              : event.persona
              ? [event.persona]
              : [];
            const colorsMap =
              event.personaColors ??
              (event.persona && event.personaColor
                ? { [event.persona]: event.personaColor }
                : {});
            // CV1.E9.S3: Alma turn marker on the streaming bubble.
            // Mutually exclusive with persona signature — the Alma
            // replaces the persona path and the routing event sends
            // an empty personas array on Alma turns.
            if (event.isAlma) {
              attachAlmaSignature(div);
            } else if (personasForEvent.length > 0) {
              attachPersonaSignature(div, personasForEvent, colorsMap);
              for (const key of personasForEvent) {
                ensureCastAvatar(key, colorsMap[key]);
              }
            }
            let anyBadge = false;
            if (
              event.organization &&
              !poolOrganizations.includes(event.organization)
            ) {
              organizationBadge.textContent = `⌂ ${event.organization}`;
              organizationBadge.style.display = "";
              anyBadge = true;
            }
            if (event.journey && !poolJourneys.includes(event.journey)) {
              journeyBadge.textContent = `↝ ${event.journey}`;
              journeyBadge.style.display = "";
              anyBadge = true;
            }
            if (anyBadge) badgesEl.style.display = "";
            // Scope hot-update — symmetric counterpart to the Cast above.
            // Driven by `seededScopes` from the server (only populated when
            // the auto-seed actually wrote to the session pool on this
            // turn). Done AFTER the badge check so the "first contact"
            // badge still surfaces on the seed turn; subsequent turns see
            // the new key already in the pool and suppress the badge.
            const seeded = event.seededScopes ?? {};
            if (seeded.organization)
              ensureScopePill("organization", seeded.organization);
            // CV1.E7.S9 phase 1: per-turn mode indicator on the
            // streaming assistant bubble. Mirrors the server-rendered
            // path in mirror.tsx — a CSS pseudo-element renders the
            // glyph from data-mode-icon. The data-mode attribute is
            // set for every mode (so DOM-based diagnostics can read
            // the value); data-mode-icon is set only when there's a
            // glyph (conversational is silent — see modeIconFromKey).
            if (event.mode) {
              bubble.setAttribute("data-mode", event.mode);
              const icon = modeIconFromKey(event.mode);
              if (icon) bubble.setAttribute("data-mode-icon", icon);
            }
            if (seeded.journey) ensureScopePill("journey", seeded.journey);
            // CV1.E7.S8: stash any out-of-pool would-have-picked
            // candidates on the streaming bubble. The suggestion card
            // is appended on the `done` event (after the assistant
            // entry id is known so click can POST to divergent-run).
            if (event.wouldHavePersona) {
              div.setAttribute("data-would-have-persona", event.wouldHavePersona);
            }
            if (event.wouldHaveOrganization) {
              div.setAttribute(
                "data-would-have-organization",
                event.wouldHaveOrganization,
              );
            }
            if (event.wouldHaveJourney) {
              div.setAttribute("data-would-have-journey", event.wouldHaveJourney);
            }
          } else if (event.type === "status") {
            // Two-phase status indicator — replaces the default typing dots
            // with a labeled microtext for each pipeline phase.
            let label = "";
            if (event.phase === "composing") label = "Composing";
            else if (event.phase === "finding-voice") label = "Finding the voice";
            if (label) {
              bubble.innerHTML = `<span class="chat-status">${label}</span>`;
              statusShown = true;
              scrollToBottom();
            }
          } else if (event.type === "delta") {
            if (statusShown) {
              // First delta — clear the microtext, start rendering the stream.
              bubble.innerHTML = "";
              statusShown = false;
            }
            streamText += event.text;
            bubble.innerHTML = md(streamText);
            scrollToBottom();
          } else if (event.type === "done") {
            if (event.rail) updateRail(event.rail);
            // Attach the delete-turn × to both the user message and the
            // newly-streamed assistant message, using the entry ids the
            // server persisted this turn under.
            if (event.entries) {
              attachDeleteForm(userMsgNode, event.entries.userEntryId, sessionId);
              attachDeleteForm(div, event.entries.assistantEntryId, sessionId);
              // CV1.E7.S8: render suggestion cards now that we have
              // the assistant entry id (needed by the divergent-run
              // POST as parentEntryId). One card per axis with a
              // would-have value.
              attachOutOfPoolSuggestions(
                div,
                event.entries.assistantEntryId,
                sessionId,
              );
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    bubble.textContent = `[error: ${err.message}]`;
  }

  div.classList.remove("msg-streaming");
  sendBtn.disabled = false;
  if (sendToBtn) sendToBtn.disabled = false;
  input.focus();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  void runSend(text, null);
});

// --- CV1.E9.S4: "Enviar Para…" popover ---

const sendToBtn = document.getElementById("send-to-btn");
const sendToPopover = document.getElementById("send-to-popover");

function setSendToOpen(open) {
  if (!sendToBtn || !sendToPopover) return;
  sendToBtn.setAttribute("aria-expanded", open ? "true" : "false");
  sendToPopover.setAttribute("data-open", open ? "true" : "false");
  sendToPopover.setAttribute("aria-hidden", open ? "false" : "true");
}

if (sendToBtn && sendToPopover) {
  sendToBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = sendToBtn.getAttribute("aria-expanded") === "true";
    setSendToOpen(!isOpen);
  });

  // Item click → submit with forced destination.
  sendToPopover.querySelectorAll("[data-destination]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const destination = item.getAttribute("data-destination");
      const text = input.value.trim();
      setSendToOpen(false);
      if (!text || !destination) return;
      void runSend(text, destination);
    });
  });

  // ESC closes.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (sendToBtn.getAttribute("aria-expanded") === "true") {
      setSendToOpen(false);
    }
  });

  // Click-outside closes.
  document.addEventListener("click", (e) => {
    if (sendToBtn.getAttribute("aria-expanded") !== "true") return;
    const target = e.target;
    if (!target) return;
    if (sendToPopover.contains(target)) return;
    if (sendToBtn.contains(target)) return;
    setSendToOpen(false);
  });
}

scrollToBottom();
