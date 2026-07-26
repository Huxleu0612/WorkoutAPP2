/* Greedy largest-plate-first loader. Weights are kg-native, same as the rest of the app —
   the UI converts for display via wStr/fmtW, same pattern as profile.goalKg etc. */
export const DEFAULT_EQUIPMENT = {
  barKg: 20,
  plates: [
    { kg: 25, pairsOwned: 2 },
    { kg: 20, pairsOwned: 2 },
    { kg: 15, pairsOwned: 1 },
    { kg: 10, pairsOwned: 2 },
    { kg: 5, pairsOwned: 2 },
    { kg: 2.5, pairsOwned: 2 },
    { kg: 1.25, pairsOwned: 1 },
  ],
};

export function calcPlateLoad(targetKg, barKg, plates) {
  const perSide = Math.max(0, (targetKg - barKg) / 2);
  const sorted = [...plates].filter((p) => p.kg > 0 && p.pairsOwned > 0).sort((a, b) => b.kg - a.kg);
  let remaining = perSide;
  const used = [];
  for (const p of sorted) {
    let n = 0;
    while (n < p.pairsOwned && p.kg <= remaining + 1e-6) { remaining -= p.kg; n++; }
    if (n > 0) used.push({ kg: p.kg, count: n });
  }
  const achievedPerSide = perSide - Math.max(0, remaining);
  const achievedTotal = barKg + achievedPerSide * 2;
  return {
    perSide, achievedPerSide, achievedTotal, targetKg, barKg,
    plates: used,
    exact: Math.abs(achievedTotal - targetKg) < 0.01,
    belowBar: targetKg < barKg - 0.01,
    shortBy: Math.max(0, targetKg - achievedTotal),
  };
}
