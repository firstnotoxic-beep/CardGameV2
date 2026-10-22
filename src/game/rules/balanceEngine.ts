import { CardDefinition, CardAbility } from '../../types/game';

export interface BalanceEvaluation {
  statWeight: number;
  recommendedCharge: number;
  recommendedRift: number;
  currentCostWeight: number;
  balanceScore: number; // 0 to 100 (100 = perfectly balanced)
  verdict: 'balanced' | 'overpowered' | 'underpowered' | 'extreme';
  verdictTh: string;
  verdictColor: string;
  offenseRating: number;
  durabilityRating: number;
  mobilityRating: number;
  tacticalRating: number;
  warnings: string[];
  recommendations: string[];
}

export function evaluateUnitBalance(unit: {
  attack: number;
  health: number;
  defense: number;
  move: number;
  range: number;
  canCapture?: boolean;
  chargeCost: number;
  riftCost?: number;
  abilities?: CardAbility[] | any[];
}): BalanceEvaluation {
  const attack = Number(unit.attack) || 0;
  const health = Number(unit.health) || 1;
  const defense = Number(unit.defense) || 0;
  const move = Number(unit.move) || 1;
  const range = Number(unit.range) || 1;
  const canCapture = unit.canCapture ?? true;
  const chargeCost = Math.max(1, Number(unit.chargeCost) || 1);
  const riftCost = Math.max(0, Number(unit.riftCost) || 0);

  // 1. Calculate Component Ratings
  // Range multiplier on attack: range >= 3 is very impactful in a 3x7 grid!
  const rangeMultiplier = range >= 3 ? 1.6 : range === 2 ? 1.3 : 1.0;
  const offenseRating = Math.round((attack * rangeMultiplier + (range > 1 ? 2 : 0)) * 10) / 10;

  // Durability: Defense mitigates every normal attack, so defense is heavily weighted
  const effectiveHp = health + defense * 2.2;
  const durabilityRating = Math.round(effectiveHp * 10) / 10;

  // Mobility & Map Presence
  const mobilityRating = Math.round((move * 1.5 + (canCapture ? 1.5 : 0)) * 10) / 10;

  // Ability Ratings
  let abilityWeight = 0;
  if (Array.isArray(unit.abilities)) {
    unit.abilities.forEach((ab) => {
      const p = Number(ab.powerValue) || 2;
      const trigMultiplier = ab.trigger === 'deploy' ? 1.2 : ab.trigger === 'death' ? 0.8 : 1.0;
      abilityWeight += p * 1.2 * trigMultiplier;
    });
  }
  const tacticalRating = Math.round(abilityWeight * 10) / 10;

  // 2. Total Stat Weight
  const totalStatWeight =
    offenseRating * 1.2 +
    durabilityRating * 0.9 +
    mobilityRating * 0.8 +
    tacticalRating * 1.1;

  // 3. Recommended Resource Cost
  // Standard baseline: ~4.2 stat weight per 1 Charge point
  let recommendedCharge = Math.round(totalStatWeight / 4.2);
  recommendedCharge = Math.max(1, Math.min(9, recommendedCharge));

  const recommendedRift = totalStatWeight >= 24 || (recommendedCharge >= 5 && tacticalRating >= 4) ? 1 : 0;

  // 4. Current Cost Evaluation
  const currentCostWeight = chargeCost * 4.2 + riftCost * 6.0;
  const difference = totalStatWeight - currentCostWeight;

  const warnings: string[] = [];
  const recommendations: string[] = [];

  // 5. Warnings on Specific Extreme Combinations
  if (range >= 3 && attack >= 5 && effectiveHp >= 8) {
    warnings.push('ระวัง: มีระยะโจมตีไกลถึง 3-4 ช่อง พร้อมพลังโจมตีและ HP สูงมาก อาจไม่มีจุดอ่อนให้คู่ต่อสู้เข้าประชิด');
  }

  if (attack >= 6 && chargeCost <= 2) {
    warnings.push('ระวัง: พลังโจมตีสูงมาก (6+) แต่ค่าร่าย Charge ต่ำ (1-2) ทำให้เกิดความได้เปรียบต้นเกมอย่างรุนแรง (Glass Cannon เกินมาตรฐาน)');
  }

  if (defense >= 4 && health >= 8 && chargeCost <= 3) {
    warnings.push('ระวัง: เกราะป้องกัน 4+ รวมกับเลือดหนา 8+ ในค่าร่าย 3 จะทำให้คู่ต่อสู้ไม่สามารถเจาะทะลุเลนได้');
  }

  if (move >= 3 && canCapture && attack >= 4 && chargeCost <= 2) {
    warnings.push('ระวัง: เคลื่อนพลได้เร็ว 3 ช่องและยึดฐานได้ พร้อมพลังโจมตีสูง อาจทำให้ยึดครองจุดยุทธศาสตร์กลางได้เร็วเกินไป');
  }

  if (unit.abilities && unit.abilities.length >= 2 && chargeCost <= 2) {
    warnings.push('คำเตือน: มียูนิตความสามารถ 2 อย่างในค่าร่ายเพียง 1-2 Charge มักจะทรงพลังเกินไป');
  }

  // 6. Verdict and Balance Score
  let verdict: 'balanced' | 'overpowered' | 'underpowered' | 'extreme' = 'balanced';
  let verdictTh = 'สมดุลเหมาะสม (Balanced)';
  let verdictColor = 'text-emerald-400';
  let balanceScore = 100;

  if (difference > 8) {
    verdict = 'extreme';
    verdictTh = 'แข็งแกร่งเกินเกณฑ์มาก (Extremely Overpowered)';
    verdictColor = 'text-rose-500';
    balanceScore = Math.max(20, Math.round(100 - difference * 5));
    recommendations.push(`แนะนำให้เพิ่มค่าร่ายเป็น ${recommendedCharge} Charge หรือลดสเตตัสลง`);
  } else if (difference > 4) {
    verdict = 'overpowered';
    verdictTh = 'ค่อนข้างได้เปรียบ (Overpowered)';
    verdictColor = 'text-amber-400';
    balanceScore = Math.max(50, Math.round(100 - difference * 6));
    recommendations.push(`เพิ่มค่าร่ายเป็น ${recommendedCharge} Charge หรือลด HP/ATK ลงเล็กน้อย`);
  } else if (difference < -7) {
    verdict = 'underpowered';
    verdictTh = 'ค่าร่ายสูงเกินความสามารถ (Underpowered)';
    verdictColor = 'text-cyan-400';
    balanceScore = Math.max(40, Math.round(100 - Math.abs(difference) * 5));
    recommendations.push(`สามารถลดค่าร่ายเหลือ ${recommendedCharge} Charge หรือเพิ่มสเตตัสเพื่อความคุ้มค่า`);
  } else {
    balanceScore = Math.min(100, Math.max(85, Math.round(100 - Math.abs(difference) * 3)));
  }

  recommendations.push('หมายเหตุ: การประเมินสมดุลเป็นเพียงแนวทางวิเคราะห์เชิงสถิติ ไม่ใช่การรับประกันความสมดุลสัมบูรณ์ในการเล่นจริง');

  return {
    statWeight: Math.round(totalStatWeight * 10) / 10,
    recommendedCharge,
    recommendedRift,
    currentCostWeight: Math.round(currentCostWeight * 10) / 10,
    balanceScore,
    verdict,
    verdictTh,
    verdictColor,
    offenseRating,
    durabilityRating,
    mobilityRating,
    tacticalRating,
    warnings,
    recommendations,
  };
}
