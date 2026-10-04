// اختبارات محرك الخادم على الحالات المشتركة مع محرك Swift.
// التشغيل: deno test --allow-read supabase/functions/_shared/engine.test.ts
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { calculate } from "./engine.ts";
import { runFixtureCases } from "./engine_fixtures.ts";

const fixtureUrl = new URL(
  "../../../Packages/QudraEngine/Tests/QudraEngineTests/Fixtures/engine_cases.json",
  import.meta.url,
);
const fixtures = JSON.parse(await Deno.readTextFile(fixtureUrl));

runFixtureCases(fixtures, calculate, {
  test: (name, fn) => Deno.test(name, fn),
  equal: (actual, expected, msg) => assertEquals(actual, expected, msg),
  close: (actual, expected, msg) => assertAlmostEquals(actual, expected, 0.01, msg),
});
