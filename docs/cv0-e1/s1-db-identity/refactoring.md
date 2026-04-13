[< Docs](../../index.md)

# Refactoring: CV0.E1.S1 — DB + Identity Transfer

Refactoring decisions made after the initial implementation was complete and tested.

---

### Templates extracted to .md files

**Before:** three multi-line string constants (STARTER_SOUL, STARTER_IDENTITY, STARTER_BEHAVIOR) inline in admin.ts.

**After:** `server/templates/soul.md`, `server/templates/identity.md`, `server/templates/behavior.md` loaded at runtime via `loadTemplate()`.

**Why:** separates data from logic. Templates are editable without touching code.

---

### Command handlers extracted from main()

**Before:** main() was ~120 lines with a chain of if/else blocks, each containing the full logic for a command.

**After:** each command extracted to its own function (handleUserAdd, handleIdentitySet, handleIdentityList, handleIdentityImport). Shared logic extracted to requireUser(). main() reduced to ~10 lines of dispatch.

**Why:** each handler is self-contained and testable. main() reads as a table of contents.

---

### Evaluated but not done

**Schema in a separate file.** The schema is a ~30-line string constant tightly coupled to db.ts — it defines what db.ts works with. Moving it to a separate file would add a file for one constant. Not worth it at this size.

**Breaking up db.ts.** At ~180 lines with one clear responsibility (all SQL lives here), splitting into user-db.ts, identity-db.ts, etc. would create 4 tiny files with the same pattern. Revisit when db.ts grows past ~300 lines (e.g., when compaction or memory enter the picture).

---

**See also:** [Plan](plan.md) · [Test Guide](test-guide.md)
