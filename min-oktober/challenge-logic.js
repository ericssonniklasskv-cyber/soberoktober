(function attachChallengeLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SoberOctoberChallengeLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createChallengeLogic() {
  const PARTS = Object.freeze(['first', 'second']);

  function completedParts(result, challenge) {
    const mode = challenge?.completion_mode || 'single';
    const saved = Array.isArray(result?.completed_parts)
      ? result.completed_parts.filter((part) => PARTS.includes(part))
      : ['first'];

    if (mode === 'single') return ['first'];
    return [...new Set(saved.length ? saved : ['first'])];
  }

  function partDetails(challenge, part) {
    if (!challenge) return null;
    if (part === 'second') {
      return {
        description: String(challenge.second_description || '').trim(),
        baseAmount: Number(challenge.second_base_amount),
        unit: String(challenge.second_unit || '').trim(),
      };
    }
    return {
      description: String(challenge.description || '').trim(),
      baseAmount: Number(challenge.base_amount),
      unit: String(challenge.unit || '').trim() || String(challenge.title || '').trim(),
    };
  }

  function describePart(challenge, part) {
    const details = partDetails(challenge, part);
    if (!details) return '';
    return details.description
      || [Number.isFinite(details.baseAmount) && details.baseAmount > 0 ? details.baseAmount : '', details.unit]
        .filter(Boolean)
        .join(' ')
      || (part === 'first' ? String(challenge.title || '').trim() : '');
  }

  function aggregateExerciseTotals(results = [], challenges = []) {
    const challengeByDate = new Map(challenges.map((challenge) => [challenge.challenge_date, challenge]));
    const totalsByUnit = new Map();

    results.forEach((result) => {
      const multiplier = Number(result.multiplier);
      if (![1, 2, 3].includes(multiplier)) return;
      const challenge = challengeByDate.get(result.result_date);
      if (!challenge) return;

      completedParts(result, challenge).forEach((part) => {
        const details = partDetails(challenge, part);
        if (!details.unit || !Number.isFinite(details.baseAmount) || details.baseAmount <= 0) return;
        const key = details.unit.toLocaleLowerCase('sv-SE');
        const current = totalsByUnit.get(key) || { unit: details.unit, amount: 0 };
        current.amount += details.baseAmount * multiplier;
        totalsByUnit.set(key, current);
      });
    });

    return [...totalsByUnit.values()].sort((a, b) => a.unit.localeCompare(b.unit, 'sv-SE'));
  }

  function sumBonusPoints(claims = [], start = null, end = null) {
    return claims.reduce((total, claim) => (
      (!start || claim.challenge_date >= start)
      && (!end || claim.challenge_date <= end)
        ? total + (Number(claim.points) || 0)
        : total
    ), 0);
  }

  return Object.freeze({ PARTS, completedParts, partDetails, describePart, aggregateExerciseTotals, sumBonusPoints });
}));
