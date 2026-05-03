import type { FC } from "hono/jsx";
import type { User, Inscription } from "../../../server/db.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * Inscriptions management (CV1.E12.S3). The quiet edit surface for the
 * phrases that render at the top of /espelho. List + add form + per-row
 * actions; archived band collapsed at the bottom.
 *
 * No JS — every action is a tiny POST form. <details> handles both the
 * inline edit row and the archived band.
 */
export const InscricoesPage: FC<{
  user: User;
  active: Inscription[];
  archived: Inscription[];
}> = ({ user, active, archived }) => {
  return (
    <TopBarLayout title={ts("espelho.inscricoes.title")} user={user}>
      <style>{INSCRICOES_STYLES}</style>

      <div class="inscricoes-page">
        <a href="/espelho" class="inscricoes-back">
          {ts("espelho.inscricoes.back")}
        </a>
        <h1 class="inscricoes-heading">{ts("espelho.inscricoes.heading")}</h1>
        <p class="inscricoes-subheading">
          {ts("espelho.inscricoes.subheading")}
        </p>

        <AddForm />

        {active.length === 0 ? (
          <p class="inscricoes-empty">{ts("espelho.inscricoes.empty")}</p>
        ) : (
          <ul class="inscricoes-list">
            {active.map((i) => (
              <ActiveRow inscription={i} />
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <details class="inscricoes-archived">
            <summary>
              {ts("espelho.inscricoes.archived.show", { n: archived.length })}
            </summary>
            <ul class="inscricoes-list inscricoes-list--archived">
              {archived.map((i) => (
                <ArchivedRow inscription={i} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </TopBarLayout>
  );
};

const AddForm: FC = () => (
  <form
    method="POST"
    action="/espelho/inscricoes"
    class="inscricoes-add"
    aria-label="add inscription"
  >
    <h2 class="inscricoes-add-heading">{ts("espelho.inscricoes.add.heading")}</h2>
    <label class="inscricoes-field">
      <span class="inscricoes-field-label">
        {ts("espelho.inscricoes.add.text.label")}
      </span>
      <textarea
        name="text"
        required
        rows={2}
        placeholder={ts("espelho.inscricoes.add.text.placeholder")}
        class="inscricoes-input inscricoes-textarea"
      />
    </label>
    <label class="inscricoes-field">
      <span class="inscricoes-field-label">
        {ts("espelho.inscricoes.add.author.label")}
      </span>
      <input
        type="text"
        name="author"
        placeholder={ts("espelho.inscricoes.add.author.placeholder")}
        class="inscricoes-input"
      />
    </label>
    <button type="submit" class="inscricoes-submit">
      {ts("espelho.inscricoes.add.submit")}
    </button>
  </form>
);

const ActiveRow: FC<{ inscription: Inscription }> = ({ inscription }) => {
  const isPinned = inscription.pinned_at !== null;
  return (
    <li class="inscricoes-row">
      <div class="inscricoes-row-text">
        <blockquote class="inscricoes-row-quote">{inscription.text}</blockquote>
        {inscription.author && (
          <cite class="inscricoes-row-author">— {inscription.author}</cite>
        )}
        {isPinned && (
          <span class="inscricoes-pinned-badge">
            ★ {ts("espelho.inscricoes.pinned.badge")}
          </span>
        )}
      </div>
      <div class="inscricoes-row-actions">
        <details class="inscricoes-row-edit">
          <summary>{ts("espelho.inscricoes.action.edit")}</summary>
          <form
            method="POST"
            action={`/espelho/inscricoes/${inscription.id}/edit`}
            class="inscricoes-edit-form"
          >
            <textarea
              name="text"
              required
              rows={2}
              class="inscricoes-input inscricoes-textarea"
            >
              {inscription.text}
            </textarea>
            <input
              type="text"
              name="author"
              value={inscription.author ?? ""}
              placeholder={ts("espelho.inscricoes.add.author.placeholder")}
              class="inscricoes-input"
            />
            <button type="submit" class="inscricoes-submit-small">
              {ts("espelho.inscricoes.action.save")}
            </button>
          </form>
        </details>
        <form
          method="POST"
          action={`/espelho/inscricoes/${inscription.id}/${
            isPinned ? "unpin" : "pin"
          }`}
          class="inscricoes-action-form"
        >
          <button type="submit" class="inscricoes-action-btn">
            {isPinned
              ? ts("espelho.inscricoes.action.unpin")
              : ts("espelho.inscricoes.action.pin")}
          </button>
        </form>
        <form
          method="POST"
          action={`/espelho/inscricoes/${inscription.id}/archive`}
          class="inscricoes-action-form"
          onsubmit={`return confirm(${JSON.stringify(
            ts("espelho.inscricoes.confirm.archive"),
          )})`}
        >
          <button type="submit" class="inscricoes-action-btn">
            {ts("espelho.inscricoes.action.archive")}
          </button>
        </form>
      </div>
    </li>
  );
};

const ArchivedRow: FC<{ inscription: Inscription }> = ({ inscription }) => (
  <li class="inscricoes-row inscricoes-row--archived">
    <div class="inscricoes-row-text">
      <blockquote class="inscricoes-row-quote">{inscription.text}</blockquote>
      {inscription.author && (
        <cite class="inscricoes-row-author">— {inscription.author}</cite>
      )}
    </div>
    <div class="inscricoes-row-actions">
      <form
        method="POST"
        action={`/espelho/inscricoes/${inscription.id}/unarchive`}
        class="inscricoes-action-form"
      >
        <button type="submit" class="inscricoes-action-btn">
          {ts("espelho.inscricoes.action.unarchive")}
        </button>
      </form>
    </div>
  </li>
);

const INSCRICOES_STYLES = `
  .inscricoes-page {
    --serif: 'Iowan Old Style', 'Charter', 'Georgia', serif;
    max-width: 760px; margin: 2rem auto 5rem;
    padding: 0 1.5rem;
  }

  .inscricoes-back {
    display: inline-block;
    color: #718096;
    font-size: 0.85rem;
    text-decoration: none;
    margin-bottom: 1rem;
  }
  .inscricoes-back:hover { color: #2c5282; text-decoration: underline; }

  .inscricoes-heading {
    font-size: 1.5rem;
    font-weight: 500;
    color: #2a2a2a;
    margin: 0 0 0.4rem;
  }
  .inscricoes-subheading {
    color: #718096;
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0 0 2rem;
    max-width: 560px;
  }

  /* ADD FORM */
  .inscricoes-add {
    display: flex; flex-direction: column;
    gap: 0.8rem;
    padding: 1rem 1.2rem 1.2rem;
    background: #fdfcf9;
    border: 1px solid #edf2f7;
    border-radius: 6px;
    margin-bottom: 2rem;
  }
  .inscricoes-add-heading {
    margin: 0 0 0.3rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #2c5282;
    font-weight: 600;
  }
  .inscricoes-field {
    display: flex; flex-direction: column;
    gap: 0.3rem;
  }
  .inscricoes-field-label {
    font-size: 0.78rem;
    color: #4a5568;
    font-weight: 500;
  }
  .inscricoes-input {
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    padding: 0.5rem 0.7rem;
    font: inherit;
    color: #2a2a2a;
    background: #fff;
    width: 100%;
    box-sizing: border-box;
  }
  .inscricoes-textarea {
    resize: vertical;
    font-family: var(--serif);
    font-style: italic;
    font-size: 0.95rem;
  }
  .inscricoes-submit {
    align-self: flex-start;
    padding: 0.45rem 1rem;
    background: #2c5282;
    color: #fff;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
  }
  .inscricoes-submit:hover { background: #234876; }
  .inscricoes-submit-small {
    padding: 0.3rem 0.7rem;
    background: #2c5282;
    color: #fff;
    border: 0;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.78rem;
    align-self: flex-start;
  }
  .inscricoes-submit-small:hover { background: #234876; }

  /* LIST */
  .inscricoes-list {
    list-style: none;
    margin: 0; padding: 0;
    display: flex; flex-direction: column;
    gap: 1rem;
  }
  .inscricoes-empty {
    color: #a0aec0; font-style: italic;
    font-family: var(--serif);
    text-align: center;
    padding: 2rem 0;
  }
  .inscricoes-row {
    display: flex; flex-direction: column;
    gap: 0.6rem;
    padding: 0.9rem 1.1rem;
    background: #fff;
    border: 1px solid #edf2f7;
    border-radius: 4px;
  }
  .inscricoes-row-text {
    display: flex; flex-direction: column;
    gap: 0.2rem;
  }
  .inscricoes-row-quote {
    margin: 0;
    font-family: var(--serif);
    font-style: italic;
    color: #2a2a2a;
    font-size: 0.98rem;
    line-height: 1.5;
  }
  .inscricoes-row-author {
    color: #a0aec0;
    font-size: 0.78rem;
    font-style: normal;
    letter-spacing: 0.04em;
  }
  .inscricoes-pinned-badge {
    align-self: flex-start;
    margin-top: 0.3rem;
    font-size: 0.7rem;
    color: #b8956a;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 500;
  }

  .inscricoes-row-actions {
    display: flex; flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.7rem;
    border-top: 1px solid #f0f4f8;
    padding-top: 0.5rem;
  }
  .inscricoes-action-form { margin: 0; }
  .inscricoes-action-btn {
    background: transparent;
    border: 0;
    padding: 0;
    color: #4a6fa5;
    cursor: pointer;
    font-size: 0.78rem;
    text-decoration: none;
  }
  .inscricoes-action-btn:hover { text-decoration: underline; }

  .inscricoes-row-edit summary {
    color: #4a6fa5;
    cursor: pointer;
    font-size: 0.78rem;
    list-style: none;
  }
  .inscricoes-row-edit summary::-webkit-details-marker { display: none; }
  .inscricoes-row-edit summary:hover { text-decoration: underline; }
  .inscricoes-edit-form {
    margin-top: 0.6rem;
    display: flex; flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .inscricoes-row--archived .inscricoes-row-quote {
    color: #718096;
  }

  /* ARCHIVED BAND */
  .inscricoes-archived {
    margin-top: 2.5rem;
  }
  .inscricoes-archived summary {
    color: #718096;
    font-size: 0.82rem;
    cursor: pointer;
    padding: 0.5rem 0;
  }
  .inscricoes-archived summary:hover { color: #2c5282; }
  .inscricoes-list--archived {
    margin-top: 0.8rem;
    opacity: 0.85;
  }
`;
