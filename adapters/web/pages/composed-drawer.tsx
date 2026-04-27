import type { FC } from "hono/jsx";
import type { IdentityLayer, Organization, Journey } from "../../../server/db.js";
import { ts } from "../i18n.js";

/**
 * Shared composed-prompt drawer. Anchored to the right edge, opens via
 * `[data-open-drawer]` elements, closes via `[data-close-drawer]` or Escape.
 *
 * Four axes of composition preview: persona, organization, journey, adapter.
 * Each axis is nullable. The drawer's JS (public/layout.js) reads the
 * selected values and fetches `endpoint?persona=...&organization=...&journey=...&adapter=...`
 * whenever a selection changes.
 *
 * `endpoint` is the JSON route that returns `{ prompt, persona, adapter, ... }`.
 * Per-surface host decides the endpoint path (e.g., "/map/composed").
 */
export const ComposedDrawer: FC<{
  endpoint: string;
  personas: IdentityLayer[];
  organizations: Organization[];
  journeys: Journey[];
}> = ({ endpoint, personas, organizations, journeys }) => {
  return (
    <aside class="composed-drawer" data-state="closed" data-endpoint={endpoint}>
      <div class="composed-drawer-overlay" data-close-drawer></div>
      <div class="composed-drawer-panel">
        <header class="composed-drawer-header">
          <h2>{ts("composed.title")}</h2>
          <button
            type="button"
            class="composed-drawer-close"
            data-close-drawer
            aria-label={ts("composed.close")}
          >
            ×
          </button>
        </header>
        <div class="composed-drawer-controls">
          <label>
            <span>{ts("composed.persona")}</span>
            <select id="composed-persona">
              <option value="none">{ts("composed.persona.none")}</option>
              {personas.map((p) => (
                <option value={p.key}>{p.key}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{ts("composed.organization")}</span>
            <select id="composed-organization">
              <option value="none">{ts("composed.none")}</option>
              {organizations.map((o) => (
                <option value={o.key}>{o.key}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{ts("composed.journey")}</span>
            <select id="composed-journey">
              <option value="none">{ts("composed.none")}</option>
              {journeys.map((j) => (
                <option value={j.key}>{j.key}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{ts("composed.adapter")}</span>
            <select id="composed-adapter">
              <option value="none">{ts("composed.none")}</option>
              <option value="web">web</option>
              <option value="telegram">telegram</option>
              <option value="cli">cli</option>
            </select>
          </label>
        </div>
        <pre class="composed-drawer-content">{ts("composed.openToLoad")}</pre>
      </div>
    </aside>
  );
};
