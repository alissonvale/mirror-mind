(() => {
  const form = document.querySelector(".workshop-form");
  if (!form) return;

  const endpoint = form.dataset.composeEndpoint;
  if (!endpoint) return;

  const textarea = form.querySelector("#workshop-content");
  const preview = document.querySelector("#workshop-preview-body");
  if (!textarea || !preview) return;

  let timer = null;
  let inFlight = null;

  async function refreshPreview() {
    const body = new URLSearchParams({ content: textarea.value });
    const controller = new AbortController();
    if (inFlight) inFlight.abort();
    inFlight = controller;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.composed === "string") {
        preview.textContent = data.composed;
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        // Preview is best-effort; failures are silent.
      }
    } finally {
      if (inFlight === controller) inFlight = null;
    }
  }

  textarea.addEventListener("input", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(refreshPreview, 400);
  });
})();
