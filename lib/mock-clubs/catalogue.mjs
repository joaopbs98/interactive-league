const identities = [
  ["porto_vigil", "Porto Vigil", "Vigil", "PVG", "Porto", "#173B67", "#E8B44A", "shield_star", "builder"],
  ["lisboa_atlas", "Lisboa Atlas", "Atlas", "LAT", "Lisboa", "#7A1538", "#F4D35E", "roundel", "star_chaser"],
  ["braga_forge", "Braga Forge", "Forge", "BGF", "Braga", "#A61B1B", "#F0EEE9", "tower", "aggressive"],
  ["coimbra_aurora", "Coimbra Aurora", "Aurora", "COA", "Coimbra", "#3B2E7E", "#7FDBDA", "diamond", "prospect_hunter"],
  ["setubal_mariner", "Setúbal Mariner", "Mariner", "STM", "Setúbal", "#146B57", "#F2C14E", "wings", "seller"],
  ["aveiro_tide", "Aveiro Tide", "Tide", "AVT", "Aveiro", "#087E8B", "#F5F5F5", "roundel", "conservative"],
  ["faro_sol", "Faro Sol", "Sol", "FRS", "Faro", "#E86A33", "#192A51", "shield_star", "builder"],
  ["guimaraes_crown", "Guimarães Crown", "Crown", "GMC", "Guimarães", "#1B1B1B", "#D4AF37", "tower", "star_chaser"],
  ["evora_legion", "Évora Legion", "Legion", "EVL", "Évora", "#5D1F32", "#E7D7C1", "diamond", "aggressive"],
  ["viseu_oaks", "Viseu Oaks", "Oaks", "VSO", "Viseu", "#285943", "#D9B44A", "shield", "prospect_hunter"],
  ["leiria_falcons", "Leiria Falcons", "Falcons", "LFC", "Leiria", "#214E8A", "#F4A261", "wings", "seller"],
  ["sintra_royals", "Sintra Royals", "Royals", "SNR", "Sintra", "#522B5B", "#E9C46A", "shield_star", "conservative"],
  ["cascais_wave", "Cascais Wave", "Wave", "CSW", "Cascais", "#006D77", "#EDF6F9", "roundel", "builder"],
  ["chaves_guard", "Chaves Guard", "Guard", "CHG", "Chaves", "#8C1C13", "#F5E6CA", "tower", "aggressive"],
  ["tomar_templars", "Tomar Templars", "Templars", "TMT", "Tomar", "#343A40", "#C9A227", "diamond", "conservative"],
  ["lagos_navigators", "Lagos Navigators", "Navigators", "LGN", "Lagos", "#005F73", "#EE9B00", "wings", "prospect_hunter"],
  ["beja_union", "Beja Union", "Union", "BJU", "Beja", "#7F5539", "#EDE0D4", "shield", "seller"],
  ["tavira_comets", "Tavira Comets", "Comets", "TVC", "Tavira", "#264653", "#E76F51", "shield_star", "star_chaser"],
  ["nazare_storm", "Nazaré Storm", "Storm", "NZS", "Nazaré", "#023E8A", "#90E0EF", "roundel", "aggressive"],
  ["elvas_frontier", "Elvas Frontier", "Frontier", "ELF", "Elvas", "#386641", "#F2E8CF", "tower", "builder"],
];

export const MOCK_CLUB_CATALOGUE = Object.freeze(
  identities.map(([
    key,
    name,
    shortName,
    acronym,
    city,
    primaryColor,
    secondaryColor,
    badge,
    personality,
  ]) => Object.freeze({
    key,
    name,
    shortName,
    acronym,
    city,
    primaryColor,
    secondaryColor,
    badge,
    personality,
  })),
);

export function availableMockClubs(usedIdentityKeys = []) {
  const used = new Set(usedIdentityKeys);
  return MOCK_CLUB_CATALOGUE.filter((club) => !used.has(club.key));
}
