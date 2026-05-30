const KM_SAME_SYSTEM = 3_500;
const KM_CROSS_SYSTEM = 18_000;

function estimateJumpKm(fromSystem, toSystem) {
  if (!fromSystem || !toSystem) return KM_SAME_SYSTEM;
  if (fromSystem.toLowerCase() === toSystem.toLowerCase()) return KM_SAME_SYSTEM;
  return KM_CROSS_SYSTEM;
}

function formatKm(km) {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(2)} Mm`;
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
  return `${Math.round(km)} km`;
}

module.exports = { estimateJumpKm, formatKm, KM_SAME_SYSTEM, KM_CROSS_SYSTEM };
