const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const messages = document.getElementById("messages");
const sendBtn = form.querySelector("button");

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg msg-${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  div.appendChild(bubble);
  messages.appendChild(div);
  scrollToBottom();
  return bubble;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  sendBtn.disabled = true;

  addMessage("user", text);

  const div = document.createElement("div");
  div.className = "msg msg-assistant msg-streaming";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  div.appendChild(bubble);
  messages.appendChild(div);
  scrollToBottom();

  try {
    const response = await fetch(
      `/chat/stream?text=${encodeURIComponent(text)}`,
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
          if (event.type === "delta") {
            bubble.textContent += event.text;
            scrollToBottom();
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
