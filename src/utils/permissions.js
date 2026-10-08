import { disconnectSocket } from './socket';

export function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
        return null;
    }
}

export function logout() {
    // ປິດ socket ກ່ອນລ້າງ token: socket ຈຳ token ຄັ້ງທີ່ສ້າງ ຖ້າບໍ່ disconnect
    // ຜູ້ໃຊ້ຄົນຕໍ່ໄປ login ໃໝ່ຈະໄດ້ room ຂອງ user ເດີມ
    disconnectSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

function isFullAdmin(user) {
    return user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
}

export function hasPermission(moduleKey, action = 'read') {
    const user = getCurrentUser();
    if (!user) return false;
    if (isFullAdmin(user)) return true;

    const perms = user.permissions || [];
    const mod = perms.find((p) => p.module === moduleKey);
    return !!mod && Array.isArray(mod.actions) && mod.actions.includes(action);
}

export function canView(moduleKey) {
    return hasPermission(moduleKey, 'read');
}

// ໜ້າ/ແຖບ ທີ່ບໍ່ໃຫ້ບາງ role ເຫັນ ເຖິງວ່າຈະມີສິດ read ກໍ່ຕາມ.
// ສິດ read ຍັງຄົງໄວ້ ເພື່ອໃຫ້ລະບົບດຶງຂໍ້ມູນ (dropdown, ຊື່ສາຂາ/ພະແນກ, ປະເພດບັນຫາ...) ໄດ້ປົກກະຕິ
// ສະເພາະການສະແດງເມນູ / ໜ້າ / ປຸ່ມສ້າງ / ຜົນການຄົ້ນຫາ ເທົ່ານັ້ນທີ່ຖືກເຊື່ອງ
const HIDDEN_PAGES_BY_ROLE = {
    EMPLOYEE: ['ticket-types', 'roles', 'branches', 'departments'],
};

// ໜ້າທີ່ຕ້ອງເຊື່ອງຕາມ path (ໃຊ້ເມື່ອ module ຖືກໃຊ້ຮ່ວມກັບໜ້າອື່ນທີ່ຍັງຕ້ອງເຫັນ)
// ເຊັ່ນ /assets (ຈັດການຊັບສິນ) ໃຊ້ module 'supplies' ຮ່ວມກັບ /supplies (ຂໍອຸປະກອນສິ້ນເປືອງ)
const HIDDEN_PATHS_BY_ROLE = {
    EMPLOYEE: ['/assets'],
};

export function canSeePath(path) {
    const user = getCurrentUser();
    if (!user || !path) return true;
    const cleanPath = path.split('?')[0];
    const hidden = HIDDEN_PATHS_BY_ROLE[user.role] || [];
    return !hidden.includes(cleanPath);
}

function isPageHiddenForRole(moduleKey) {
    const user = getCurrentUser();
    if (!user) return false;
    const hidden = HIDDEN_PAGES_BY_ROLE[user.role] || [];
    return hidden.includes(moduleKey);
}

// ໃຊ້ສຳລັບ UI ເທົ່ານັ້ນ (Sidebar, Route guard, Navbar) — ບໍ່ໃຊ້ກັບການດຶງຂໍ້ມູນ
export function canSeePage(moduleKey) {
    return canView(moduleKey) && !isPageHiddenForRole(moduleKey);
}

export function canCreateFromMenu(moduleKey) {
    return hasPermission(moduleKey, 'create') && !isPageHiddenForRole(moduleKey);
}