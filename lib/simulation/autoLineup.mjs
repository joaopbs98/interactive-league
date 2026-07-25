const relatedPositions = {
  GK: [], CB: ['LB', 'RB', 'CDM'], LB: ['LWB', 'CB', 'LM'], RB: ['RWB', 'CB', 'RM'],
  LWB: ['LB', 'LM'], RWB: ['RB', 'RM'], CDM: ['CM', 'CB'], CM: ['CDM', 'CAM', 'LM', 'RM'],
  CAM: ['CM', 'CF'], LM: ['LW', 'CM', 'LWB'], RM: ['RW', 'CM', 'RWB'],
  LW: ['LM', 'RW', 'ST', 'CF'], RW: ['RM', 'LW', 'ST', 'CF'], CF: ['ST', 'CAM', 'LW', 'RW'], ST: ['CF', 'LW', 'RW'],
};

const ids = (player) => String(player.player_id ?? player.playerId ?? player.id ?? '');
const rating = (player) => Number(player.rating ?? player.overall_rating ?? player.overallRating ?? 0);
const positions = (player) => String(player.positions ?? '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);

function suitability(player, slot) {
  const natural = positions(player);
  const target = String(slot || '').toUpperCase();
  const isGoalkeeper = natural.includes('GK');
  if ((target === 'GK') !== isGoalkeeper) return -10000;
  if (natural[0] === target) return 300 + rating(player);
  if (natural.includes(target)) return 250 + rating(player);
  if ((relatedPositions[target] || []).some((position) => natural.includes(position))) return 150 + rating(player);
  return rating(player);
}

export function buildAutomaticSquadSelection(roster, formationSlots) {
  const available = [...(roster || [])].filter((player) => ids(player));
  const startingLineup = [];
  for (const slot of formationSlots || []) {
    available.sort((a, b) => suitability(b, slot) - suitability(a, slot));
    const selected = available.shift();
    if (!selected) break;
    startingLineup.push(ids(selected));
  }
  available.sort((a, b) => rating(b) - rating(a));
  return {
    startingLineup,
    bench: available.slice(0, 7).map(ids),
    reserves: available.slice(7).map(ids),
  };
}
