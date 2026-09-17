// ຟັງຊັນກາງສຳລັບກວດສອບສິດການເຂົ້າເຖິງ (module + action)
// ອີງໃສ່ຂໍ້ມູນ permissions ທີ່ຖອດອອກຈາກ JWT ຕອນ login ແລ້ວເກັບໄວ້ໃນ localStorage('user')
// ຮູບແບບ: user.permissions = [{ module: 'tickets', actions: ['read','create','update'] }, ...]

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
}

// ຮອງຮັບ role ພິເສດທີ່ຖືກໝາຍວ່າເປັນ admin ເຕັມສິດ (isSystemRole / role name 'ADMIN')
// ຖ້າ backend ຝັງ permissions ຄົບຖ້ວນມາໃນ token ຢູ່ແລ້ວ ອັນນີ້ຈະບໍ່ຈຳເປັນ ແຕ່ເກັບໄວ້ເປັນ fallback
function isFullAdmin(user) {
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
}

/**
 * ກວດວ່າ user ປັດຈຸບັນ ມີສິດເຮັດ action (default 'read') ໃນ module ທີ່ລະບຸ ຫຼືບໍ່
 */
export function hasPermission(moduleKey, action = 'read') {
  const user = getCurrentUser();
  if (!user) return false;
  if (isFullAdmin(user)) return true;

  const perms = user.permissions || [];
  const mod = perms.find((p) => p.module === moduleKey);
  return !!mod && Array.isArray(mod.actions) && mod.actions.includes(action);
}

/**
 * ກວດວ່າ user ມີສິດ read (ເຂົ້າເບິ່ງ) module ນັ້ນຫຼືບໍ່ — ໃຊ້ສຳລັບເປີດ/ປິດ menu ແລະ guard route
 */
export function canView(moduleKey) {
  return hasPermission(moduleKey, 'read');
}
