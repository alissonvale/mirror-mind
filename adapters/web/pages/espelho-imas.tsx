import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User, Inscription } from "../../../server/db.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * Ímãs — management surface for the user-pinned phrases that render
 * at the top of /espelho (CV1.E12.S3). The data layer still calls
 * them "inscriptions" internally; the user-facing name is "Ímãs"
 * (PT) / "Magnets" (EN), echoing the fridge-magnet metaphor —
 * something quietly chosen, kept where you'll meet it.
 *
 * No JS — every action is a tiny POST + redirect. <details> handles
 * both the inline edit row and the archived band.
 */
export const ImasPage: FC<{
  user: User;
  active: Inscription[];
  archived: Inscription[];
}> = ({ user, active, archived }) => {
  return (
    <TopBarLayout title={ts("espelho.imas.title")} user={user}>
      <style>{raw(IMAS_STYLES)}</style>

      <div class="imas-page">
        <a href="/" class="imas-back">
          {ts("espelho.imas.back")}
        </a>
        <h1 class="imas-heading">{ts("espelho.imas.heading")}</h1>
        <p class="imas-subheading">{ts("espelho.imas.subheading")}</p>

        <AddForm />

        {active.length === 0 ? (
          <p class="imas-empty">{ts("espelho.imas.empty")}</p>
        ) : (
          <ul class="imas-list">
            {active.map((i) => (
              <ActiveRow inscription={i} />
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <details class="imas-archived">
            <summary>
              {ts("espelho.imas.archived.show", { n: archived.length })}
            </summary>
            <ul class="imas-list imas-list--archived">
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
    action="/espelho/imas"
    class="imas-add"
    aria-label="add ima"
  >
    <h2 class="imas-add-heading">{ts("espelho.imas.add.heading")}</h2>
    <label class="imas-field">
      <span class="imas-field-label">
        {ts("espelho.imas.add.text.label")}
      </span>
      <textarea
        name="text"
        required
        rows={2}
        placeholder={ts("espelho.imas.add.text.placeholder")}
        class="imas-input imas-textarea"
      />
    </label>
    <label class="imas-field">
      <span class="imas-field-label">
        {ts("espelho.imas.add.author.label")}
      </span>
      <input
        type="text"
        name="author"
        placeholder={ts("espelho.imas.add.author.placeholder")}
        class="imas-input"
      />
    </label>
    <button type="submit" class="imas-submit">
      {ts("espelho.imas.add.submit")}
    </button>
  </form>
);

const ActiveRow: FC<{ inscription: Inscription }> = ({ inscription }) => {
  const isPinned = inscription.pinned_at !== null;
  return (
    <li class="imas-row">
      <div class="imas-row-text">
        <blockquote class="imas-row-quote">{inscription.text}</blockquote>
        {inscription.author && (
          <cite class="imas-row-author">— {inscription.author}</cite>
        )}
        {isPinned && (
          <span class="imas-pinned-badge">
            ★ {ts("espelho.imas.pinned.badge")}
          </span>
        )}
      </div>
      <div class="imas-row-actions">
        <details class="imas-row-edit">
          <summary>{ts("espelho.imas.action.edit")}</summary>
          <form
            method="POST"
            action={`/espelho/imas/${inscription.id}/edit`}
            class="imas-edit-form"
          >
            <textarea
              name="text"
              required
              rows={2}
              class="imas-input imas-textarea"
            >
              {inscription.text}
            </textarea>
            <input
              type="text"
              name="author"
              value={inscription.author ?? ""}
              placeholder={ts("espelho.imas.add.author.placeholder")}
              class="imas-input"
            />
            <button type="submit" class="imas-submit-small">
              {ts("espelho.imas.action.save")}
            </button>
          </form>
        </details>
        <form
          method="POST"
          action={`/espelho/imas/${inscription.id}/${
            isPinned ? "unpin" : "pin"
          }`}
          class="imas-action-form"
        >
          <button type="submit" class="imas-action-btn">
            {isPinned
              ? ts("espelho.imas.action.unpin")
              : ts("espelho.imas.action.pin")}
          </button>
        </form>
        <form
          method="POST"
          action={`/espelho/imas/${inscription.id}/archive`}
          class="imas-action-form"
          onsubmit={`return confirm(${JSON.stringify(
            ts("espelho.imas.confirm.archive"),
          )})`}
        >
          <button type="submit" class="imas-action-btn">
            {ts("espelho.imas.action.archive")}
          </button>
        </form>
      </div>
    </li>
  );
};

const ArchivedRow: FC<{ inscription: Inscription }> = ({ inscription }) => (
  <li class="imas-row imas-row--archived">
    <div class="imas-row-text">
      <blockquote class="imas-row-quote">{inscription.text}</blockquote>
      {inscription.author && (
        <cite class="imas-row-author">— {inscription.author}</cite>
      )}
    </div>
    <div class="imas-row-actions">
      <form
        method="POST"
        action={`/espelho/imas/${inscription.id}/unarchive`}
        class="imas-action-form"
      >
        <button type="submit" class="imas-action-btn">
          {ts("espelho.imas.action.unarchive")}
        </button>
      </form>
    </div>
  </li>
);

const IMAS_STYLES = `
  .imas-page {
    --serif: 'Iowan Old Style', 'Charter', 'Georgia', serif;
    max-width: 760px; margin: 2rem auto 5rem;
    padding: 0 1.5rem;
  }

  .imas-back {
    display: inline-block;
    color: #718096;
    font-size: 0.85rem;
    text-decoration: none;
    margin-bottom: 1rem;
  }
  .imas-back:hover { color: #2c5282; text-decoration: underline; }

  .imas-heading {
    font-size: 1.5rem;
    font-weight: 500;
    color: #2a2a2a;
    margin: 0 0 0.4rem;
  }
  .imas-subheading {
    color: #718096;
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0 0 2rem;
    max-width: 560px;
  }

  /* ADD FORM */
  .imas-add {
    display: flex; flex-direction: column;
    gap: 0.8rem;
    padding: 1rem 1.2rem 1.2rem;
    background: #fdfcf9;
    border: 1px solid #edf2f7;
    border-radius: 6px;
    margin-bottom: 2rem;
  }
  .imas-add-heading {
    margin: 0 0 0.3rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #2c5282;
    font-weight: 600;
  }
  .imas-field {
    display: flex; flex-direction: column;
    gap: 0.3rem;
  }
  .imas-field-label {
    font-size: 0.78rem;
    color: #4a5568;
    font-weight: 500;
  }
  .imas-input {
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    padding: 0.5rem 0.7rem;
    font: inherit;
    color: #2a2a2a;
    background: #fff;
    width: 100%;
    box-sizing: border-box;
  }
  .imas-textarea {
    resize: vertical;
    font-family: var(--serif);
    font-style: italic;
    font-size: 0.95rem;
  }
  .imas-submit {
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
  .imas-submit:hover { background: #234876; }
  .imas-submit-small {
    padding: 0.3rem 0.7rem;
    background: #2c5282;
    color: #fff;
    border: 0;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.78rem;
    align-self: flex-start;
  }
  .imas-submit-small:hover { background: #234876; }

  /* LIST */
  .imas-list {
    list-style: none;
    margin: 0; padding: 0;
    display: flex; flex-direction: column;
    gap: 1rem;
  }
  .imas-empty {
    color: #a0aec0; font-style: italic;
    font-family: var(--serif);
    text-align: center;
    padding: 2rem 0;
  }
  .imas-row {
    display: flex; flex-direction: column;
    gap: 0.6rem;
    padding: 0.9rem 1.1rem;
    background: #fff;
    border: 1px solid #edf2f7;
    border-radius: 4px;
  }
  .imas-row-text {
    display: flex; flex-direction: column;
    gap: 0.2rem;
  }
  .imas-row-quote {
    margin: 0;
    font-family: var(--serif);
    font-style: italic;
    color: #2a2a2a;
    font-size: 0.98rem;
    line-height: 1.5;
  }
  .imas-row-author {
    color: #a0aec0;
    font-size: 0.78rem;
    font-style: normal;
    letter-spacing: 0.04em;
  }
  .imas-pinned-badge {
    align-self: flex-start;
    margin-top: 0.3rem;
    font-size: 0.7rem;
    color: #b8956a;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 500;
  }

  .imas-row-actions {
    display: flex; flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.7rem;
    border-top: 1px solid #f0f4f8;
    padding-top: 0.5rem;
  }
  .imas-action-form { margin: 0; }
  .imas-action-btn {
    background: transparent;
    border: 0;
    padding: 0;
    color: #4a6fa5;
    cursor: pointer;
    font-size: 0.78rem;
    text-decoration: none;
  }
  .imas-action-btn:hover { text-decoration: underline; }

  .imas-row-edit summary {
    color: #4a6fa5;
    cursor: pointer;
    font-size: 0.78rem;
    list-style: none;
  }
  .imas-row-edit summary::-webkit-details-marker { display: none; }
  .imas-row-edit summary:hover { text-decoration: underline; }
  .imas-edit-form {
    margin-top: 0.6rem;
    display: flex; flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .imas-row--archived .imas-row-quote {
    color: #718096;
  }

  /* ARCHIVED BAND */
  .imas-archived {
    margin-top: 2.5rem;
  }
  .imas-archived summary {
    color: #718096;
    font-size: 0.82rem;
    cursor: pointer;
    padding: 0.5rem 0;
  }
  .imas-archived summary:hover { color: #2c5282; }
  .imas-list--archived {
    margin-top: 0.8rem;
    opacity: 0.85;
  }
`;
