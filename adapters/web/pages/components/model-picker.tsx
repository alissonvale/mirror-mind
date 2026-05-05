import type { FC } from "hono/jsx";
import type { CatalogEntry } from "../../../../server/db/models-catalog.js";
import { ts } from "../../i18n.js";

/**
 * Reusable model picker (CV1.E15.S1). Server-rendered combobox: a
 * `<input list="…">` paired with a `<datalist>` populated from the
 * catalog. The native combobox accepts free typing (admin power user)
 * and offers selection (admin discovering models).
 *
 * The form field name is configurable so the same component can drop
 * into different forms (admin/models uses `name="model"`; the scene
 * form will use `name="model_id"` with a sibling provider input).
 *
 * `listId` must be unique on the page when the picker renders multiple
 * times — `<datalist>` is matched by id.
 */
export const ModelPicker: FC<{
  name: string;
  value: string;
  catalog: CatalogEntry[];
  listId: string;
  required?: boolean;
  className?: string;
  /**
   * When set, only catalog entries from this provider render in the
   * datalist. Admin users can still type any value into the input —
   * this is suggestion filtering, not validation.
   */
  filterProvider?: string;
  /**
   * Pass-through data attribute (e.g., `data-models-id`) so existing
   * page-level JS hooks keep working when the picker replaces a plain
   * input.
   */
  dataAttr?: { name: string; value: string };
}> = ({
  name,
  value,
  catalog,
  listId,
  required,
  className,
  filterProvider,
  dataAttr,
}) => {
  const filtered = filterProvider
    ? catalog.filter(
        (e) => e.provider.toLowerCase() === filterProvider.toLowerCase(),
      )
    : catalog;
  const dataProps: Record<string, string> = {};
  if (dataAttr) dataProps[dataAttr.name] = dataAttr.value;
  return (
    <>
      <input
        type="text"
        name={name}
        value={value}
        list={listId}
        required={required}
        class={className ?? "models-input"}
        autocomplete="off"
        spellcheck={false}
        {...dataProps}
      />
      <datalist id={listId}>
        {filtered.map((e) => {
          const optionValue = `${e.provider}/${e.model_id}`;
          const label = formatOptionLabel(e);
          return <option value={optionValue} label={label} />;
        })}
      </datalist>
      {filtered.length === 0 && (
        <small class="model-picker-hint" data-empty="true">
          {ts("admin.models.catalogEmpty")}
        </small>
      )}
    </>
  );
};

function formatOptionLabel(e: CatalogEntry): string {
  const parts: string[] = [];
  if (e.display_name) parts.push(e.display_name);
  const priceBits: string[] = [];
  if (e.price_brl_per_1m_input !== undefined) {
    priceBits.push(`R$${e.price_brl_per_1m_input.toFixed(2)}/1M in`);
  }
  if (e.price_brl_per_1m_output !== undefined) {
    priceBits.push(`R$${e.price_brl_per_1m_output.toFixed(2)}/1M out`);
  }
  if (priceBits.length > 0) parts.push(`(${priceBits.join(", ")})`);
  return parts.join(" ");
}
