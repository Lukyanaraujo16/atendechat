const readJson = (raw, fallback) => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : fallback;
  } catch (e) {
    return fallback;
  }
};

const favKey = (userId) => `qmChat_favorites_${userId}`;
const recentKey = (userId) => `qmChat_recent_${userId}`;

export const getFavoriteIds = (userId) => {
  if (userId == null) return [];
  return readJson(localStorage.getItem(favKey(userId)), []);
};

const setFavoriteIds = (userId, ids) => {
  if (userId == null) return;
  localStorage.setItem(favKey(userId), JSON.stringify(ids));
};

export const setFavorite = (userId, messageId, isFavorite) => {
  const id = Number(messageId);
  if (!id) return getFavoriteIds(userId);
  let ids = getFavoriteIds(userId);
  if (isFavorite) {
    if (!ids.includes(id)) ids = [id, ...ids];
  } else {
    ids = ids.filter((x) => x !== id);
  }
  setFavoriteIds(userId, ids);
  return ids;
};

export const toggleFavorite = (userId, messageId) => {
  const id = Number(messageId);
  if (!id) return getFavoriteIds(userId);
  const has = getFavoriteIds(userId).includes(id);
  return setFavorite(userId, id, !has);
};

export const getRecentIds = (userId) => {
  if (userId == null) return [];
  return readJson(localStorage.getItem(recentKey(userId)), []);
};

/**
 * @param {number|string} userId
 * @param {number} messageId
 * @param {number} [max=10]
 */
export const recordRecentUse = (userId, messageId, max = 10) => {
  const id = Number(messageId);
  if (!userId || !id) return;
  const next = [id, ...getRecentIds(userId).filter((x) => x !== id)].slice(0, max);
  localStorage.setItem(recentKey(userId), JSON.stringify(next));
  return next;
};
