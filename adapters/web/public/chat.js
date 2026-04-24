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

  // Composed block
  setText(
    "rail-layers",
    state.composed.layers.length ? state.composed.layers.join(" · ") : "—",
  );
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

// Read the last assistant's persona from the DOM, skipping the node
// passed in (which is the currently-streaming bubble being decorated).
// The msg wrapper carries `data-persona="<key>"` on every
// server-rendered row (empty string when no persona) and is set by
// attachPersonaSignature on streamed rows. Returns null if the last
// preceding assistant had no persona — a null turn resets continuity
// so the next persona'd turn gets a fresh badge.
function lastAssistantPersonaInDOM(currentNode) {
  const nodes = messages.querySelectorAll(".msg-assistant");
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i] === currentNode) continue;
    const persona = nodes[i].getAttribute("data-persona") || "";
    return persona || null;
  }
  return null;
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
function ensureCastAvatar(personaKey) {
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
  const wrap = document.createElement("span");
  wrap.className = "header-cast-avatar-wrap";
  wrap.setAttribute("data-persona", personaKey);
  const avatar = document.createElement("span");
  avatar.className = "header-cast-avatar";
  avatar.style.background = personaColor(personaKey);
  avatar.setAttribute("title", personaKey);
  avatar.setAttribute("aria-label", personaKey);
  avatar.textContent = personaInitials(personaKey);
  wrap.appendChild(avatar);
  // Insert before the '+' add control if present, otherwise append.
  const addCtrl = list.querySelector(".header-cast-add");
  if (addCtrl) list.insertBefore(wrap, addCtrl);
  else list.appendChild(wrap);
}

function attachPersonaSignature(msgNode, personaKey) {
  if (!msgNode || !personaKey) return;
  const bubble = msgNode.querySelector(".bubble");
  const badgesEl = msgNode.querySelector(".msg-badges");
  if (!bubble) return;
  const color = personaColor(personaKey);
  // Color bar: always on persona'd assistant bubbles.
  bubble.style.borderLeft = `3px solid ${color}`;
  // Mark the wrapper so lastAssistantPersonaInDOM() can read it.
  const last = lastAssistantPersonaInDOM(msgNode);
  msgNode.setAttribute("data-persona", personaKey);
  // Text badge: only on persona TRANSITIONS (first persona in session,
  // or persona differs from the previous assistant's persona). Same
  // rule the server-side render uses.
  if (last !== personaKey && badgesEl) {
    const badge = document.createElement("span");
    badge.className = "msg-badge msg-badge-persona";
    badge.textContent = `◇ ${personaKey}`;
    badgesEl.insertBefore(badge, badgesEl.firstChild);
    badgesEl.style.display = "";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  sendBtn.disabled = true;
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
    const response = await fetch(
      `/conversation/stream?text=${encodeURIComponent(text)}${bypassPersona}`,
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
            if (event.persona) {
              attachPersonaSignature(div, event.persona);
              ensureCastAvatar(event.persona);
            }
            let anyBadge = false;
            if (
              event.organization &&
              !poolOrganizations.includes(event.organization)
            ) {
              organizationBadge.textContent = `◈ ${event.organization}`;
              organizationBadge.style.display = "";
              anyBadge = true;
            }
            if (event.journey && !poolJourneys.includes(event.journey)) {
              journeyBadge.textContent = `↝ ${event.journey}`;
              journeyBadge.style.display = "";
              anyBadge = true;
            }
            if (anyBadge) badgesEl.style.display = "";
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
  input.focus();
});

scrollToBottom();
