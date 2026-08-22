export type ClassTier = 1 | 2 | 3 | 4;

export interface ClassDefinition {
  id: string;
  name: string;
  tier: ClassTier;
  parentId?: string;
  role: 'tank' | 'healer' | 'melee' | 'ranged' | 'caster' | 'support';
  masteryPassive: string;
  skills: string[];
}

export const TIER_FACTORS: Record<ClassTier, number> = { 1: 1, 2: 2.5, 3: 6, 4: 15 };

export const CLASSES: ClassDefinition[] = [
  { id: 'novice', name: 'Novice', tier: 1, role: 'melee', masteryPassive: 'Adaptable: +2% all stats', skills: ['Strike'] },
  { id: 'guardian', name: 'Guardian', tier: 2, parentId: 'novice', role: 'tank', masteryPassive: 'Iron Will: +5% defense', skills: ['Shield Bash', 'Taunt'] },
  { id: 'cleric', name: 'Cleric', tier: 2, parentId: 'novice', role: 'healer', masteryPassive: 'Grace: +5% healing', skills: ['Mend', 'Cleanse'] },
  { id: 'ranger', name: 'Ranger', tier: 2, parentId: 'novice', role: 'ranged', masteryPassive: 'Eagle Eye: +3% crit', skills: ['Quick Shot', 'Mark'] },
  { id: 'arcanist', name: 'Arcanist', tier: 2, parentId: 'novice', role: 'caster', masteryPassive: 'Arcane Memory: +5% skill power', skills: ['Ember', 'Frost Bolt'] },
  { id: 'knight', name: 'Knight', tier: 3, parentId: 'guardian', role: 'tank', masteryPassive: 'Bulwark: +8% block', skills: ['Aegis', 'Provoke'] },
  { id: 'paladin', name: 'Paladin', tier: 3, parentId: 'cleric', role: 'tank', masteryPassive: 'Radiance: +5% defense and healing', skills: ['Holy Guard', 'Judgment'] },
  { id: 'priest', name: 'Priest', tier: 3, parentId: 'cleric', role: 'healer', masteryPassive: 'Benediction: +8% healing', skills: ['Greater Mend', 'Renew'] },
  { id: 'assassin', name: 'Assassin', tier: 3, parentId: 'ranger', role: 'melee', masteryPassive: 'Executioner: +10% crit damage', skills: ['Ambush', 'Poison Edge'] },
  { id: 'marksman', name: 'Marksman', tier: 3, parentId: 'ranger', role: 'ranged', masteryPassive: 'Deadeye: +6% crit', skills: ['Piercing Shot', 'Volley'] },
  { id: 'elementalist', name: 'Elementalist', tier: 3, parentId: 'arcanist', role: 'caster', masteryPassive: 'Attunement: +8% elemental power', skills: ['Fireball', 'Ice Lance'] },
  { id: 'warden', name: 'Warden', tier: 4, parentId: 'knight', role: 'tank', masteryPassive: 'Unbroken: +12% max HP', skills: ['Fortress', 'Last Stand'] },
  { id: 'saint', name: 'Saint', tier: 4, parentId: 'priest', role: 'healer', masteryPassive: 'Miracle: +12% healing', skills: ['Sanctuary', 'Resurrection'] },
  { id: 'spellblade', name: 'Spellblade', tier: 4, parentId: 'elementalist', role: 'caster', masteryPassive: 'Spellsteel: +10% skill power', skills: ['Arc Slash', 'Cataclysm Ward'] }
];

export const classById = (id: string): ClassDefinition => CLASSES.find((entry) => entry.id === id) ?? CLASSES[0]!;
