/**
 * GradeService — Robusta coffee grade determination.
 *
 * Standards referenced: SCAA Green Coffee Grading and ICE EU Robusta.
 * ALL quality criteria live here in the backend — NOT in any smart contract.
 *
 * Grade results: 'CR1' | 'CR2' | 'CR3' | 'REJECTED'
 *
 * Robusta Grade Reference (per 300g sample):
 * ──────────────────────────────────────────────────────────
 * CR1   ≤ 5 defects | 0 primary defects | moisture 9–13%
 * CR2   ≤ 8 defects | 0 primary defects | ≤ 3 immature | moisture 9–13%
 * CR3   9–23 defects | screen-size OK   | ≤ 5 immature | moisture 9–13%
 * REJECTED  anything else
 * ──────────────────────────────────────────────────────────
 */

const MOISTURE_MIN = 9;
const MOISTURE_MAX = 13;

/**
 * Determine grade from inspection parameters.
 *
 * @param {object} params
 * @param {number} params.defectCount      Total defect count per 300g
 * @param {number} params.moisturePct      Moisture percentage
 * @param {number} params.immatureBeans    Count of immature beans
 * @param {boolean} params.screenSizeOk   Passes sieve/screen size test
 * @param {boolean} params.hasPrimaryDefect  Any primary defect present (mold, insect, etc.)
 *
 * @returns {{ grade: 'CR1'|'CR2'|'CR3'|'REJECTED', reasons: string[] }}
 */
export function determineGrade({
  defectCount,
  moisturePct,
  immatureBeans   = 0,
  screenSizeOk    = true,
  hasPrimaryDefect = false,
}) {
  const reasons = [];

  // Moisture is a hard gate for all grades
  if (moisturePct < MOISTURE_MIN || moisturePct > MOISTURE_MAX) {
    reasons.push(`Moisture ${moisturePct}% out of range (${MOISTURE_MIN}–${MOISTURE_MAX}%)`);
    return { grade: 'REJECTED', reasons };
  }

  // CR1 — strictest
  if (
    defectCount    <= 5  &&
    !hasPrimaryDefect    &&
    immatureBeans  === 0
  ) {
    return { grade: 'CR1', reasons: [] };
  }

  // CR2
  if (
    defectCount    <= 8  &&
    !hasPrimaryDefect    &&
    immatureBeans  <= 3
  ) {
    return { grade: 'CR2', reasons: [] };
  }

  // CR3
  if (
    defectCount    >= 9  &&
    defectCount    <= 23 &&
    screenSizeOk         &&
    immatureBeans  <= 5
  ) {
    return { grade: 'CR3', reasons: [] };
  }

  // Build rejection reasons
  if (defectCount > 23)  reasons.push(`Defect count ${defectCount} exceeds maximum (23)`);
  if (hasPrimaryDefect)  reasons.push('Primary defect present (mould / insect damage)');
  if (immatureBeans > 5) reasons.push(`Immature beans ${immatureBeans} exceeds maximum (5)`);
  if (!screenSizeOk)     reasons.push('Does not pass screen-size requirement');

  return { grade: 'REJECTED', reasons };
}

/**
 * Grade → token type mapping.
 * 'REJECTED' lots must NOT be minted.
 */
export function gradeToTokenType(grade) {
  const map = { CR1: 'CR1', CR2: 'CR2', CR3: 'CR3' };
  return map[grade] || null;
}

/**
 * Validate that a lot split is consistent:
 * each sub-lot must sum to ≤ parent weight and each must have exactly one grade.
 *
 * @param {number} parentWeightKg
 * @param {Array<{weightKg: number, grade: string}>} subLots
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateLotSplit(parentWeightKg, subLots) {
  const totalSubWeight = subLots.reduce((s, l) => s + Number(l.weightKg), 0);
  if (totalSubWeight > Number(parentWeightKg) + 0.01) {
    return {
      ok:    false,
      error: `Sub-lot total (${totalSubWeight} kg) exceeds parent lot (${parentWeightKg} kg)`,
    };
  }

  for (const lot of subLots) {
    if (!['CR1', 'CR2', 'CR3', 'REJECTED'].includes(lot.grade)) {
      return { ok: false, error: `Invalid grade: ${lot.grade}` };
    }
    if (Number(lot.weightKg) <= 0) {
      return { ok: false, error: `Sub-lot weight must be > 0 kg` };
    }
  }

  return { ok: true };
}

export default { determineGrade, gradeToTokenType, validateLotSplit };
