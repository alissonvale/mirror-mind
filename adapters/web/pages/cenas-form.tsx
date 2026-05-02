import type { FC } from "hono/jsx";
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
  cenaKey?: string;       // present in edit mode, used to build action URL + delete form
  cenaStatus?: "active" | "archived";
  error?: string;
  saved?: "created" | "updated";
  sidebarScopes?: SidebarScopes;
}> = ({ user, mode, data, cenaKey, cenaStatus, error, saved, sidebarScopes }) => {
  const action =
    mode === "create" ? "/cenas/nova" : `/cenas/${cenaKey}/editar`;
  const pageTitle =
    mode === "create"
      ? ts("scenes.form.create.title")
      : ts("scenes.form.edit.title");

  return (
    <Layout title={pageTitle} user={user} sidebarScopes={sidebarScopes}>
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
          >
            {data.briefing}
          </textarea>

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
            <input
              type="text"
              name="personas"
              value={data.personas.join(", ")}
              placeholder={ts("scenes.form.cast.placeholder")}
              class="scope-input"
            />
          </fieldset>

          <label class="workshop-label" for="cena-org">
            {ts("scenes.form.org.label")}
          </label>
          <input
            id="cena-org"
            type="text"
            name="organization_key"
            value={data.organization_key}
            placeholder={ts("scenes.form.org.placeholder")}
            class="scope-input"
          />

          <label class="workshop-label" for="cena-journey">
            {ts("scenes.form.journey.label")}
          </label>
          <input
            id="cena-journey"
            type="text"
            name="journey_key"
            value={data.journey_key}
            placeholder={ts("scenes.form.journey.placeholder")}
            class="scope-input"
          />

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
