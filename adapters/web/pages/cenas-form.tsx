import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { Layout, type SidebarScopes } from "./layout.js";
import type {
  User,
  Scene,
  ResponseMode,
  ResponseLength,
} from "../../../server/db.js";
import { ts } from "../i18n.js";

export interface CenaFormData {
  title: string;
  temporal_pattern: string;
  briefing: string;
  voice: "persona" | "alma";
  personas: string[];           // P2: comma-separated input; P4 will chip-ify
  organization_key: string;
  journey_key: string;
  response_mode: ResponseMode | "auto";
  response_length: ResponseLength | "auto";
}

export interface CenaFormInventory {
  personas: Array<{ key: string; name: string }>;
  organizations: Array<{ key: string; name: string }>;
  journeys: Array<{ key: string; name: string }>;
}

export function emptyCenaFormInventory(): CenaFormInventory {
  return { personas: [], organizations: [], journeys: [] };
}

/**
 * JSON-stringify the inventory and escape `</` so the literal can sit
 * safely inside a `<script type="application/json">` block. Without
 * this, a `</script` substring inside any name (e.g. a persona named
 * `</script>`) would close the script tag prematurely.
 */
function safeInventoryJson(inv: CenaFormInventory): string {
  return JSON.stringify(inv).replace(/</g, "\\u003c");
}

const SubCreationStub: FC<{ kind: "persona" | "organization" | "journey" }> = ({
  kind,
}) => {
  const headingKey =
    kind === "persona"
      ? "scenes.form.stub.persona.heading"
      : kind === "organization"
        ? "scenes.form.stub.organization.heading"
        : "scenes.form.stub.journey.heading";
  return (
    <div class="cena-substub" data-cena-substub={kind} hidden>
      <h3 class="cena-substub-heading">{ts(headingKey)}</h3>
      <label class="cena-substub-label">
        {ts("scenes.form.stub.name")}
        <input type="text" data-stub-field="name" class="scope-input" />
      </label>
      <label class="cena-substub-label">
        {ts("scenes.form.stub.key")}
        <input type="text" data-stub-field="key" class="scope-input" />
      </label>
      <label class="cena-substub-label">
        {ts("scenes.form.stub.description")}
        <input
          type="text"
          data-stub-field="description"
          class="scope-input"
          placeholder={ts("scenes.form.stub.description.placeholder")}
        />
      </label>
      <div class="cena-substub-actions">
        <button type="button" class="workshop-cancel" data-stub-action="cancel">
          {ts("scenes.form.action.cancel")}
        </button>
        <button type="button" class="workshop-save" data-stub-action="save">
          {ts("scenes.form.stub.save")}
        </button>
      </div>
      <p class="cena-substub-error" data-stub-error hidden></p>
    </div>
  );
};

export function emptyCenaFormData(): CenaFormData {
  return {
    title: "",
    temporal_pattern: "",
    briefing: "",
    voice: "persona",
    personas: [],
    organization_key: "",
    journey_key: "",
    response_mode: "auto",
    response_length: "auto",
  };
}

export function cenaToFormData(scene: Scene, personas: string[]): CenaFormData {
  return {
    title: scene.title,
    temporal_pattern: scene.temporal_pattern ?? "",
    briefing: scene.briefing,
    voice: scene.voice === "alma" ? "alma" : "persona",
    personas,
    organization_key: scene.organization_key ?? "",
    journey_key: scene.journey_key ?? "",
    response_mode: scene.response_mode ?? "auto",
    response_length: scene.response_length ?? "auto",
  };
}

export const CenaFormPage: FC<{
  user: User;
  mode: "create" | "edit";
  data: CenaFormData;
  inventory?: CenaFormInventory;
  cenaKey?: string;       // present in edit mode, used to build action URL + delete form
  cenaStatus?: "active" | "archived";
  error?: string;
  saved?: "created" | "updated";
  sidebarScopes?: SidebarScopes;
}> = ({
  user,
  mode,
  data,
  inventory,
  cenaKey,
  cenaStatus,
  error,
  saved,
  sidebarScopes,
}) => {
  const inv = inventory ?? emptyCenaFormInventory();
  const action =
    mode === "create" ? "/cenas/nova" : `/cenas/${cenaKey}/editar`;
  const pageTitle =
    mode === "create"
      ? ts("scenes.form.create.title")
      : ts("scenes.form.edit.title");

  return (
    <Layout title={pageTitle} user={user} sidebarScopes={sidebarScopes}>
      <style>{raw(`
        .cena-form-page { max-width: 720px; margin: 0 auto; padding: 1.5rem; }
        .cena-form .cena-briefing { min-height: 180px; font-size: 1rem; }
        .cena-voice-fieldset, .cena-cast-fieldset {
          border: 1px solid var(--border, #ddd);
          border-radius: 6px;
          padding: 0.75rem 1rem 1rem;
          margin: 0.75rem 0;
        }
        .cena-voice-fieldset legend, .cena-cast-fieldset legend {
          padding: 0 0.4rem;
          font-weight: 500;
        }
        .cena-voice-option {
          display: inline-flex; align-items: center; gap: 0.4rem;
          margin-right: 1.2rem; cursor: pointer;
        }
        .cena-cast-fieldset[hidden] { display: none; }
        .cena-advanced { margin-top: 1rem; }
        .cena-advanced summary { cursor: pointer; font-weight: 500; padding: 0.4rem 0; }
        .cena-actions { gap: 0.6rem; flex-wrap: wrap; }
        .cena-save-and-start { background: var(--accent, #2c5282); }
        .cena-lifecycle { margin-top: 2rem; }
        .scope-lifecycle-danger {
          background: transparent; color: #c53030; border: 1px solid #c53030;
          padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer;
        }
        .scope-lifecycle-danger:hover { background: #c53030; color: white; }
        .scope-status-badge-draft {
          background: #ed8936; color: white;
          padding: 0.1rem 0.4rem; border-radius: 3px;
          font-size: 0.75rem; margin-left: 0.4rem;
        }
        .cena-suggest-wrap { position: relative; }
        .cena-suggest-list {
          position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
          background: var(--bg, white);
          border: 1px solid var(--border, #ddd);
          border-radius: 0 0 6px 6px;
          margin: 0; padding: 0; list-style: none;
          max-height: 240px; overflow-y: auto;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .cena-suggest-list li {
          padding: 0.5rem 0.75rem; cursor: pointer;
        }
        .cena-suggest-list li:hover, .cena-suggest-list li.selected {
          background: var(--hover-bg, #f0f0f0);
        }
        .cena-suggest-list li.create-option {
          border-top: 1px solid var(--border, #ddd);
          color: var(--accent, #2c5282); font-weight: 500;
        }
        .cena-substub {
          border: 1px solid var(--accent, #2c5282);
          border-radius: 6px;
          padding: 0.75rem 1rem;
          margin-top: 0.5rem;
          background: var(--bg, white);
        }
        .cena-substub-heading { margin: 0 0 0.5rem; font-size: 0.95rem; }
        .cena-substub-label {
          display: block; margin-bottom: 0.5rem;
          font-size: 0.85rem;
        }
        .cena-substub-label .scope-input {
          width: 100%; margin-top: 0.2rem;
        }
        .cena-substub-actions {
          display: flex; gap: 0.5rem; justify-content: flex-end;
          margin-top: 0.6rem;
        }
        .cena-substub-error { color: #c53030; margin: 0.4rem 0 0; font-size: 0.85rem; }
      `)}</style>
      <div class="cena-form-page">
        <nav class="workshop-breadcrumb">
          <a href="/">{ts("common.cancel")}</a>
          <span class="workshop-breadcrumb-sep">/</span>
          <span>{pageTitle}</span>
          {cenaStatus === "archived" && (
            <span class="scope-status-badge">
              {ts("scope.statusBadge.archived")}
            </span>
          )}
        </nav>

        <header class="workshop-header">
          <h1>{pageTitle}</h1>
        </header>

        {error && (
          <div class="summary-status summary-status-warn" role="alert">
            {error}
          </div>
        )}
        {saved === "created" && (
          <div class="summary-status summary-status-ok" role="status">
            {ts("scenes.form.saved.created")}
          </div>
        )}
        {saved === "updated" && (
          <div class="summary-status summary-status-ok" role="status">
            {ts("scenes.form.saved.updated")}
          </div>
        )}

        <form
          method="POST"
          action={action}
          class="workshop-form cena-form"
          data-cena-form
        >
          <label class="workshop-label" for="cena-title">
            {ts("scenes.form.title.label")}
          </label>
          <input
            id="cena-title"
            type="text"
            name="title"
            value={data.title}
            required
            class="scope-input"
            autofocus
          />

          <label class="workshop-label" for="cena-temporal">
            {ts("scenes.form.temporalPattern.label")}
          </label>
          <input
            id="cena-temporal"
            type="text"
            name="temporal_pattern"
            value={data.temporal_pattern}
            placeholder={ts("scenes.form.temporalPattern.placeholder")}
            class="scope-input"
          />

          <label class="workshop-label" for="cena-briefing">
            {ts("scenes.form.briefing.label")}
          </label>
          <span class="scope-field-hint">
            {ts("scenes.form.briefing.help")}
          </span>
          <textarea
            id="cena-briefing"
            name="briefing"
            class="workshop-textarea scope-textarea cena-briefing"
            spellcheck="false"
          >{data.briefing}</textarea>

          <fieldset class="cena-voice-fieldset">
            <legend class="workshop-label">
              {ts("scenes.form.voice.label")}
            </legend>
            <label class="cena-voice-option">
              <input
                type="radio"
                name="voice"
                value="persona"
                checked={data.voice === "persona"}
                data-cena-voice
              />
              {ts("scenes.form.voice.persona")}
            </label>
            <label class="cena-voice-option">
              <input
                type="radio"
                name="voice"
                value="alma"
                checked={data.voice === "alma"}
                data-cena-voice
              />
              {ts("scenes.form.voice.alma")}
            </label>
          </fieldset>

          <fieldset
            class="cena-cast-fieldset"
            data-cena-elenco-fieldset
            hidden={data.voice === "alma" ? true : false}
          >
            <legend class="workshop-label">
              {ts("scenes.form.cast.label")}
            </legend>
            <span class="scope-field-hint">
              {ts("scenes.form.cast.help")}
            </span>
            <div class="cena-suggest-wrap" data-cena-suggest="persona">
              <input
                type="text"
                name="personas"
                value={data.personas.join(", ")}
                placeholder={ts("scenes.form.cast.placeholder")}
                class="scope-input"
                autocomplete="off"
              />
              <ul class="cena-suggest-list" hidden></ul>
              <SubCreationStub kind="persona" />
            </div>
          </fieldset>

          <label class="workshop-label" for="cena-org">
            {ts("scenes.form.org.label")}
          </label>
          <div class="cena-suggest-wrap" data-cena-suggest="organization">
            <input
              id="cena-org"
              type="text"
              name="organization_key"
              value={data.organization_key}
              placeholder={ts("scenes.form.org.placeholder")}
              class="scope-input"
              autocomplete="off"
            />
            <ul class="cena-suggest-list" hidden></ul>
            <SubCreationStub kind="organization" />
          </div>

          <label class="workshop-label" for="cena-journey">
            {ts("scenes.form.journey.label")}
          </label>
          <div class="cena-suggest-wrap" data-cena-suggest="journey">
            <input
              id="cena-journey"
              type="text"
              name="journey_key"
              value={data.journey_key}
              placeholder={ts("scenes.form.journey.placeholder")}
              class="scope-input"
              autocomplete="off"
            />
            <ul class="cena-suggest-list" hidden></ul>
            <SubCreationStub kind="journey" />
          </div>

          <details class="cena-advanced">
            <summary>{ts("scenes.form.advanced.label")}</summary>
            <label class="workshop-label" for="cena-mode">
              {ts("scenes.form.mode.label")}
            </label>
            <select
              id="cena-mode"
              name="response_mode"
              class="scope-input"
            >
              <option value="auto" selected={data.response_mode === "auto"}>
                {ts("scenes.form.mode.auto")}
              </option>
              <option
                value="conversational"
                selected={data.response_mode === "conversational"}
              >
                {ts("scenes.form.mode.conversational")}
              </option>
              <option
                value="essayistic"
                selected={data.response_mode === "essayistic"}
              >
                {ts("scenes.form.mode.essayistic")}
              </option>
              <option
                value="oracular"
                selected={data.response_mode === "oracular"}
              >
                {ts("scenes.form.mode.oracular")}
              </option>
            </select>

            <label class="workshop-label" for="cena-length">
              {ts("scenes.form.length.label")}
            </label>
            <select
              id="cena-length"
              name="response_length"
              class="scope-input"
            >
              <option value="auto" selected={data.response_length === "auto"}>
                {ts("scenes.form.length.auto")}
              </option>
              <option value="brief" selected={data.response_length === "brief"}>
                {ts("scenes.form.length.brief")}
              </option>
              <option
                value="standard"
                selected={data.response_length === "standard"}
              >
                {ts("scenes.form.length.standard")}
              </option>
              <option value="full" selected={data.response_length === "full"}>
                {ts("scenes.form.length.full")}
              </option>
            </select>
          </details>

          <div class="workshop-actions cena-actions">
            <a href="/" class="workshop-cancel">
              {ts("scenes.form.action.cancel")}
            </a>
            <button
              type="submit"
              name="action"
              value="save"
              class="workshop-save"
            >
              {ts("scenes.form.action.save")}
            </button>
            <button
              type="submit"
              name="action"
              value="save_and_start"
              class="workshop-save cena-save-and-start"
            >
              {ts("scenes.form.action.saveAndStart")}
            </button>
          </div>
        </form>

        <script type="application/json" id="cenas-form-inventory">
          {raw(safeInventoryJson(inv))}
        </script>
        <script src="/public/cenas-form.js?v=cenas-form-2"></script>

        {mode === "edit" && cenaKey && (
          <section class="scope-lifecycle cena-lifecycle">
            <h2>{ts("scenes.form.lifecycle.heading")}</h2>
            {cenaStatus === "active" && (
              <form method="POST" action={`/cenas/${cenaKey}/archive`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scenes.form.lifecycle.archive")}
                </button>
              </form>
            )}
            {cenaStatus === "archived" && (
              <form method="POST" action={`/cenas/${cenaKey}/unarchive`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scenes.form.lifecycle.unarchive")}
                </button>
              </form>
            )}
            <form
              method="POST"
              action={`/cenas/${cenaKey}/delete`}
              onsubmit="return confirm('Excluir esta cena? Conversas vinculadas perderão a cena, mas ficam preservadas.');"
            >
              <button
                type="submit"
                class="scope-lifecycle-danger"
              >
                {ts("scenes.form.lifecycle.delete")}
              </button>
            </form>
          </section>
        )}
      </div>
    </Layout>
  );
};
