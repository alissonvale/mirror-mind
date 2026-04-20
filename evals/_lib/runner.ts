import type { Probe, ProbeResult, EvalReport } from "./types.js";

export interface RunOptions<Input, Expected> {
  /** Eval name, shown in the header. */
  name: string;
  /** Pass threshold (0..1). Defaults to 0.85. Exit code 1 if score < threshold. */
  threshold?: number;
  /** Probes to run. */
  probes: Probe<Input, Expected>[];
  /** Function under eval — maps input to actual output. */
  run: (input: Input) => Promise<Expected>;
  /** Optional equality check — defaults to strict equality. */
  equals?: (got: Expected, want: Expected) => boolean;
  /** Optional display formatter for expected/actual values. */
  format?: (value: Expected) => string;
}

/**
 * Run an eval: for each probe, call `run(input)`, compare to `want`, report
 * the results in a table, and exit with 0 on pass (score >= threshold) or 1
 * on fail. Designed for standalone scripts (`tsx evals/<name>.ts`).
 *
 * Probes run sequentially by default. LLM evals hit real APIs and real DBs —
 * parallelism is rarely worth the rate-limit / flakiness tradeoff at this
 * scale. If an eval needs concurrency, it can manage that internally inside
 * the `run` fn.
 */
export async function runEval<Input, Expected>(
  opts: RunOptions<Input, Expected>,
): Promise<EvalReport<Input, Expected>> {
  const threshold = opts.threshold ?? 0.85;
  const equals = opts.equals ?? ((a, b) => a === b);
  const format = opts.format ?? ((v) => (v === null ? "(null)" : String(v)));

  console.log(`\n▶ eval: ${opts.name}  (${opts.probes.length} probes)\n`);

  const results: ProbeResult<Input, Expected>[] = [];
  let hits = 0;

  for (const probe of opts.probes) {
    try {
      const got = await opts.run(probe.input);
      const pass = equals(got, probe.want);
      if (pass) hits++;
      results.push({ probe, got, pass });
      process.stdout.write(pass ? "." : "x");
    } catch (err) {
      results.push({
        probe,
        got: undefined as any,
        pass: false,
        error: (err as Error).message,
      });
      process.stdout.write("!");
    }
  }

  console.log("\n");

  const rows = results.map((r) => ({
    label: r.probe.label ?? truncate(String(r.probe.input), 55),
    want: format(r.probe.want),
    got: r.error ? `ERR: ${r.error.slice(0, 40)}` : format(r.got),
    ok: r.pass ? "✓" : "✗",
  }));
  console.table(rows);

  const score = opts.probes.length === 0 ? 1 : hits / opts.probes.length;
  const pct = Math.round(score * 100);
  const thresholdPct = Math.round(threshold * 100);
  const status = score >= threshold ? "PASS" : "FAIL";

  console.log(
    `\n${status}: ${hits}/${opts.probes.length} (${pct}%)  threshold: ${thresholdPct}%\n`,
  );

  const report: EvalReport<Input, Expected> = {
    name: opts.name,
    results,
    hits,
    total: opts.probes.length,
    score,
    threshold,
  };

  if (score < threshold) process.exitCode = 1;
  return report;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
