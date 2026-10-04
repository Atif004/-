// منطق تشغيل الحالات المشتركة، مستقل عن إطار الاختبار.
import type { CalculationInput, CalculationResult, FinancingRules, RuleContext } from "./engine.ts";

interface FixtureCase {
  name: string;
  rules: Partial<FinancingRules>;
  input: CalculationInput;
  expected: Partial<Record<keyof CalculationResult, unknown>> & { note_codes?: string[] };
}

export interface Fixtures {
  base_rules: FinancingRules;
  cases: FixtureCase[];
}

export interface Asserter {
  test: (name: string, fn: () => void) => void;
  equal: (actual: unknown, expected: unknown, msg?: string) => void;
  close: (actual: number, expected: number, msg?: string) => void;
}

export function runFixtureCases(
  fixtures: Fixtures,
  calculate: (input: CalculationInput, ctx: RuleContext) => CalculationResult,
  t: Asserter,
) {
  for (const c of fixtures.cases) {
    t.test(c.name, () => {
      const rules = { ...fixtures.base_rules, ...c.rules } as FinancingRules;
      const result = calculate(c.input, { rules, version: 1, isDemo: true });
      for (const [key, expected] of Object.entries(c.expected)) {
        if (key === "note_codes") {
          t.equal(result.notes.map((n) => n.code), expected, `${c.name}: note_codes`);
        } else if (typeof expected === "number") {
          t.close(result[key as keyof CalculationResult] as number, expected, `${c.name}: ${key}`);
        } else {
          t.equal(result[key as keyof CalculationResult], expected, `${c.name}: ${key}`);
        }
      }
    });
  }
}
