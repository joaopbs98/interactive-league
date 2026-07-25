export const TICKET_TIERS = {
  bronze: { boost: 1, label: "Bronze", description: "A lower-end draft reward that upgrades one player you ended last season with by +1 OVR." },
  silver: { boost: 2, label: "Silver", description: "Upgrades one player you ended last season with by +2 OVR." },
  gold: { boost: 3, label: "Gold", description: "Upgrades one player you ended last season with by +3 OVR." },
  platinum: { boost: 4, label: "Platinum", description: "Upgrades one player you ended last season with by +4 OVR." },
};

export function ticketRule(tier) {
  return TICKET_TIERS[tier] ?? TICKET_TIERS.bronze;
}

export function eligibleTicketPlayers(players, eligiblePlayerIds) {
  const eligible = new Set(eligiblePlayerIds ?? []);
  return players.filter((player) => eligible.has(player.player_id));
}
