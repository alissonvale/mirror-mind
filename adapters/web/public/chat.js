const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const messages = document.getElementById("messages");
const sendBtn = form.querySelector("button");

// --- Context Rail ---

const rail = document.getElementById("context-rail");

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

function applyAvatarStyle(id, color, empty) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.background = color;
  el.setAttribute("data-empty", empty ? "true" : "false");
}

function setCost(id, costBRL) {
  const el = document.getElementById(id);
  if (!el) return;
  if (costBRL !== null) {
    el.textContent = formatBRL(costBRL);
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
  setCost("rail-cost", state.sessionStats.costBRL);
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

  // Collapsed strip mirrors persona + cost
  setText("rail-collapsed-initials", persona ? state.personaInitials : "");
  setCost("rail-collapsed-cost", state.sessionStats.costBRL);
  applyAvatarStyle("rail-collapsed-avatar", state.personaColor, !persona);
}

// Collapse toggle + persistence
const RAIL_COLLAPSED_KEY = "mirror.rail.collapsed";

function applyCollapsed(collapsed) {
  if (!rail) return;
  rail.setAttribute("data-collapsed", collapsed ? "true" : "false");
  document.body.classList.toggle("rail-collapsed", collapsed);
}

if (rail) {
  const stored = localStorage.getItem(RAIL_COLLAPSED_KEY);
  applyCollapsed(stored === "true");

  const toggle = rail.querySelector(".rail-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = rail.getAttribute("data-collapsed") === "true";
      const next = !current;
      applyCollapsed(next);
      localStorage.setItem(RAIL_COLLAPSED_KEY, next ? "true" : "false");
    });
  }
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
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (role === "user") {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = md(text);
  }
  div.appendChild(bubble);
  messages.appendChild(div);
  scrollToBottom();
  return bubble;
}

// Render markdown in existing history bubbles
document.querySelectorAll(".msg-assistant .bubble").forEach((b) => {
  b.innerHTML = md(b.textContent || "");
});

let streamText = "";

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  sendBtn.disabled = true;
  streamText = "";

  addMessage("user", text);

  const div = document.createElement("div");
  div.className = "msg msg-assistant msg-streaming";
  const signatureEl = document.createElement("span");
  signatureEl.className = "persona-badge";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  div.appendChild(signatureEl);
  div.appendChild(bubble);
  messages.appendChild(div);
  scrollToBottom();

  try {
    const response = await fetch(
      `/mirror/stream?text=${encodeURIComponent(text)}`,
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
          if (event.type === "persona") {
            if (event.persona) {
              signatureEl.textContent = `◇ ${event.persona}`;
              signatureEl.style.display = "";
            }
          } else if (event.type === "delta") {
            streamText += event.text;
            bubble.innerHTML = md(streamText);
            scrollToBottom();
          } else if (event.type === "done") {
            if (event.rail) updateRail(event.rail);
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
