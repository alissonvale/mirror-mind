/**
 * Probe — a single input/expected pair for an eval.
 *
 * The generic types let each eval define its own shape. Routing uses
 * `Probe<string, string | null>` (message → persona key). Future evals
 * may use richer inputs (e.g., conversation history) or structured
 * expected outputs (e.g., voice-rule assertions).
 */
export interface Probe<Input, Expected> {
  input: Input;
  want: Expected;
  /** Short label shown in the report — keep under 60 chars. */
  label?: string;
  /** Human-readable note explaining why this probe exists. */
  note?: string;
}

export interface ProbeResult<Input, Expected> {
  probe: Probe<Input, Expected>;
  got: Expected;
  pass: boolean;
  error?: string;
}

export interface EvalReport<Input, Expected> {
  name: string;
  results: ProbeResult<Input, Expected>[];
  hits: number;
  total: number;
  /** Fraction of probes that passed, 0..1. */
  score: number;
  /** Threshold below which the eval is considered failing (exit 1). */
  threshold: number;
}
