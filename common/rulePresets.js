// Rule presets for Rummikub

export const OFFICIAL_RULES = {
  name: 'Official',
  description: 'Standard Rummikub rules',
  initialMeldPoints: 30,
  turnTimerSeconds: 120,
  jokerCount: 2,
  minSetSize: 3,
  maxSetSize: 13,
  tilesPerPlayer: 14,
  minPlayers: 2,
  maxPlayers: 4
};

export const CUSTOM_RULES_TEMPLATE = {
  name: 'Custom',
  description: 'Customizable rules',
  initialMeldPoints: 30,
  turnTimerSeconds: 120,
  jokerCount: 2,
  minSetSize: 3,
  maxSetSize: 13,
  tilesPerPlayer: 14,
  minPlayers: 2,
  maxPlayers: 4
};

// Validate custom rules are within acceptable bounds
export function validateCustomRules(rules) {
  const errors = [];

  if (rules.initialMeldPoints < 0 || rules.initialMeldPoints > 100) {
    errors.push('Initial meld points must be between 0 and 100');
  }

  if (rules.turnTimerSeconds < 15 || rules.turnTimerSeconds > 300) {
    errors.push('Turn timer must be between 15 and 300 seconds');
  }

  if (rules.jokerCount < 0 || rules.jokerCount > 4) {
    errors.push('Joker count must be between 0 and 4');
  }

  if (rules.tilesPerPlayer < 7 || rules.tilesPerPlayer > 21) {
    errors.push('Tiles per player must be between 7 and 21');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Get default rules (official)
export function getDefaultRules() {
  return { ...OFFICIAL_RULES };
}

// Create custom rules from partial config
export function createCustomRules(overrides = {}) {
  return {
    ...CUSTOM_RULES_TEMPLATE,
    ...overrides,
    name: 'Custom'
  };
}
