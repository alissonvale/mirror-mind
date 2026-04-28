[< Story](index.md)

# Test guide — CV1.E8.S1 LLM call logging

End-to-end manual roteiro for validating the logging surface after S1 ships.

## Pre-conditions

- `npm run dev` running with the S1 build deployed.
- Hard reload to pick up new admin assets.
- Logged in as admin (Alisson).

## Test 1 — Default toggle is ON, table is empty

Open `/admin/llm-logs`.

**Expected:**
- Header shows toggle state "Logging: ON" (or `pt-BR: "Registro: ATIVO"`).
- The list says something like "No calls recorded yet" / "Nenhuma chamada registrada ainda".

## Test 2 — A normal turn populates the log

Send any message in the chat (e.g., a casual greeting).

**Expected after the response streams in:**
- `/admin/llm-logs` reload shows at least 2-3 new rows: `reception`, `main`, possibly `expression` (skipped on Alma turns), and `title` (only on first turn of a session).
- Each row has timestamp, role, model, tokens (in/out), cost, latency.

## Test 3 — Detail view renders prompts verbatim

Click a `main` row from the list.

**Expected:**
- The `System prompt` section shows the FULL composed prompt (soul + ego + persona + adapter), preserved newlines, monospace font, scrollable when long.
- The `User message` section shows the user text exactly as typed.
- The `Response` section shows the model's actual output text.
- Metadata table shows session_id, entry_id, tokens, cost, latency, env, created_at, error (null on success).

## Test 4 — Alma turn captures the Alma preamble

Send an apontamento ("hoje passei a tarde lutando contra o tédio…") and wait for the Alma's reply.

**Expected:**
- New `reception` row with `is_self_moment: true` visible in the response JSON.
- New `main` row whose system_prompt **starts with the ALMA_PREAMBLE** ("Você é a Voz da Alma…") and includes soul + doctrine + identity below.
- No `expression` row (Alma turns skip expression).

## Test 5 — Filters work

In the list:
- Filter by **role: reception** → only reception rows show.
- Filter by **model: anthropic/claude-sonnet-4** → only that model's rows show.
- Filter by **session_id: <last session>** → only the last session's rows show.
- Search-in-prompt: enter `vazio fértil` → only rows whose system_prompt OR response contain that string show.

## Test 6 — Toggle off stops new writes

Click the toggle to turn logging OFF. Send another chat message.

**Expected:**
- Toggle now reads "Logging: OFF" / "Registro: INATIVO".
- New chat turn produces no new rows in the list (existing rows remain).

Toggle back ON. Send another message → new rows appear.

## Test 7 — Cleanup actions

Click "Clear older than 30 days" → no rows deleted (assuming the test data is recent).

Click "Clear older than 0 days" → ALL rows deleted, list goes back to empty.

Send a new chat → 1+ rows reappear.

Click "Clear all" with confirm → list empty again.

## Test 8 — Export

Reload data with a few rows. Click `Export JSON` → downloads a `.json` file with the rows as an array.

Click `Export CSV` → downloads a `.csv` file with header row + the rows; multi-line system_prompt cells are properly quoted (open in a spreadsheet to verify).

## Test 9 — Bilingual chrome

Switch user locale to pt-BR (in `/me`). Reload `/admin/llm-logs`.

**Expected:** all UI strings (page title, column headers, filter labels, button labels, toggle state, empty state) render in Portuguese.

## Test 10 — Defensive: logging never breaks the pipeline

Pre-condition: simulate a DB issue (e.g., temporarily make `llm_calls` table read-only via SQL: `PRAGMA query_only = 1`). Send a chat message.

**Expected:**
- The pipeline still produces a response (chat works normally).
- Server log shows `[llm-logging] insert failed: …` but no exception bubbles up.
- Reset `PRAGMA query_only = 0` and confirm the next turn writes normally.

## Failure modes to watch for

If any of these surface, S1 has a regression:

- **Pipeline hangs or errors when toggle is on.** Logging side-effects must be invisible to the user-facing pipeline.
- **Empty system_prompt or response in the row.** Capture point is wrong; likely the ref was read before assembly or after reset.
- **entry_id never populated for main rows.** The two-step write (insert with null, update after entry append) is broken.
- **Detail view collapses whitespace.** CSS missing `white-space: pre-wrap` on the `<pre>` blocks.
- **Filters don't combine.** Each filter must AND with the others.
- **Export drops multi-line cells.** CSV escaping (RFC 4180 quote-doubling) is wrong.

## Calibration loop

The whole point of this story is to make refinements surgical. After a week of use, the canonical workflow is:

1. User notices an Alma response that read flat / wrong.
2. User opens `/admin/llm-logs`, filters by `role: main` and `session: <current>`.
3. Picks the row for that turn → reads system_prompt to confirm the Alma preamble was as expected, doctrine was loaded, identity was loaded.
4. Reads response — was it the model not following the prompt, or did the prompt itself drift?
5. Iterates the relevant prompt source (Alma preamble, doctrine content, etc.).
6. Re-tests with a similar message; new row in the log shows the new prompt.

Without S1, step 3-4 is impossible. With S1, the loop is closed.
