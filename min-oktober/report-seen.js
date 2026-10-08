(() => {
  const memory = new Map();
  const storageKey = (userId) => `soberoktober:weekly-reports-seen:${userId}`;

  function read(userId) {
    if (!userId) return [];
    const seen = new Set(memory.get(userId) || []);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
      if (Array.isArray(saved)) saved.filter((key) => typeof key === 'string').forEach((key) => seen.add(key));
    } catch (_error) { /* Keep this tab usable if storage is unavailable. */ }
    return [...seen];
  }

  function mark(userId, periodKey) {
    if (!userId || !periodKey) return false;
    const seen = new Set(read(userId));
    const wasNew = !seen.has(periodKey);
    seen.add(periodKey);
    memory.set(userId, [...seen]);
    try { localStorage.setItem(storageKey(userId), JSON.stringify([...seen])); }
    catch (_error) { /* The current tab still remembers. */ }
    return wasNew;
  }

  window.SoberOctoberReportSeen = Object.freeze({ read, mark });
})();
