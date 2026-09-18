const API_BASE_URL = 'http://localhost:3000/api';
const CACHE_KEY = 'org_settings_cache';
export const DEFAULT_SYSTEM_NAME = 'Helpdesk Enterprise';

// ດຶງຂໍ້ມູນຊື່ລະບົບ (public endpoint — ບໍ່ຕ້ອງ login)
// ໃຊ້ cache ໃນ localStorage ເພື່ອໃຫ້ໜ້າຕ່າງໆເປີດເທື່ອທຳອິດໄວ ແລະ ສະແດງທັນທີ
export function getOrgSettings() {
  return new Promise((resolve) => {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch {
      cached = null;
    }
    if (cached) resolve(cached);

    fetch(`${API_BASE_URL}/settings/org/public`)
      .then((res) => res.json())
      .then((body) => {
        const data = body?.data ?? body ?? {};
        const settings = { systemName: data.systemName || DEFAULT_SYSTEM_NAME };
        localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
        resolve(settings);
      })
      .catch(() => {
        resolve(cached || { systemName: DEFAULT_SYSTEM_NAME });
      });
  });
}

export function cacheOrgSettings(settings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function applySystemName(name) {
  document.title = name || DEFAULT_SYSTEM_NAME;
}