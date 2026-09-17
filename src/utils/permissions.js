export function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
        return null;
    }
}

export function logout() {
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