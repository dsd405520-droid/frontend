import React, { useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { canView, logout } from '../utils/permissions';

function isTokenExpired(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1]));
    return !exp || exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export default function ProtectedRoute({ children, module, action = 'read' }) {
  const token = localStorage.getItem('token');

  useEffect(() => {
    const interval = setInterval(() => {
      const current = localStorage.getItem('token');
      if (current && isTokenExpired(current)) {
        logout();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  // `module` ອາດເປັນ string ດຽວ ຫຼື array (ໜ້າທີ່ອີງໃສ່ຫຼາຍ module, ເຊັ່ນ /branches ໃຊ້ທັງ
  // 'branches' ແລະ 'departments') — ຖ້າເປັນ array, ພຽງແຕ່ 1 module ທີ່ມີສິດກໍ່ພໍໃຫ້ເຂົ້າໜ້າໄດ້
  const modules = Array.isArray(module) ? module : module ? [module] : [];
  const allowed = modules.length === 0 || modules.some((m) => canView(m));

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">ບໍ່ມີສິດເຂົ້າເຖິງໜ້ານີ້</h2>
          <p className="text-sm text-gray-500 mb-6">
            ບົດບາດ (Role) ຂອງທ່ານບໍ່ໄດ້ຖືກອະນຸຍາດໃຫ້ເບິ່ງໂມດູນນີ້. ກະລຸນາຕິດຕໍ່ຜູ້ບໍລິຫານລະບົບຖ້າຄິດວ່ານີ້ແມ່ນຄວາມຜິດພາດ.
          </p>
          <Link to="/" className="inline-block bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition">
            ກັບໄປໜ້າຫຼັກ
          </Link>
        </div>
      </div>
    );
  }

  // ຖ້າມີ Token ແລະ ຜ່ານການກວດສິດ (ຫຼືບໍ່ຮຽກຮ້ອງສິດພິເສດ) ໃຫ້ສະແດງຜົນ Component ປົກກະຕິ
  return children;
}
