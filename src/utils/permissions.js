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