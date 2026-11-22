export const difficultyLevels = ['hard', 'medium', 'easy'];

// Integer hundredths make both calibration and boundary comparisons reproducible.
export function familiarityScore(word, features) {
  const frequency = features.wordFrequencies[word] ?? 0;
  const penalty = [...word].reduce((sum, char) => {
    const rank = features.characterRanks[char] ?? Infinity;
    return sum + (rank > 6500 ? 0.75 : rank > 3500 ? 0.25 : 0);
  }, 0);
  return Math.max(0, Math.round(100 * (Math.log10(1 + frequency) - penalty)));
}

export function classifyDifficulty(word, features, thresholds) {
  const score = familiarityScore(word, features);
  return score >= thresholds.easy ? 'easy' : score >= thresholds.medium ? 'medium' : 'hard';
}

// Maximize mean recall across the original three classes, giving each class equal weight.
// Exhaustive ordered cutoffs; ties prefer higher cutoffs (conservative classification).
export function calibrateThresholds(reference, features) {
  const samples = Object.entries(reference).flatMap(([level, words]) => words.map(word => ({ level, score: familiarityScore(word, features) })));
  const maximum = Math.max(...samples.map(row => row.score)) + 1;
  const totals = Object.fromEntries(difficultyLevels.map(level => [level, reference[level].length]));
  const prefix = Object.fromEntries(difficultyLevels.map(level => [level, Array(maximum + 1).fill(0)]));
  for (const sample of samples) prefix[sample.level][sample.score + 1]++;
  for (const level of difficultyLevels) for (let i = 1; i <= maximum; i++) prefix[level][i] += prefix[level][i - 1];
  let best = -1, thresholds;
  for (let medium = 1; medium < maximum; medium++) {
    for (let easy = medium + 1; easy <= maximum; easy++) {
      const recall = (prefix.hard[medium] / totals.hard + (prefix.medium[easy] - prefix.medium[medium]) / totals.medium + (totals.easy - prefix.easy[easy]) / totals.easy) / 3;
      if (recall >= best) { best = recall; thresholds = { medium, easy }; }
    }
  }
  return { thresholds, trainingBalancedAccuracy: best };
}
