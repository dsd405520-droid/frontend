import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Calendar, CheckCircle2, Hash, Layers, Loader2, Mail, Phone, Shield, UserRound } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { API_BASE_URL } from '../config';


function unwrap(payload) {
  return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token') || '';

  useEffect(() => {
    let cancelled = false;
    window.scrollTo(0, 0);
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API_BASE_URL}/users/${id}`, { headers }),
      fetch(`${API_BASE_URL}/branches`, { headers }).catch(() => null),
    ])
      .then(async ([userRes, branchesRes]) => {
        if (!userRes.ok) {
          const b = await userRes.json().catch(() => ({}));
          throw new Error(b?.message || `ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (HTTP ${userRes.status})`);
        }
        const userBody = await userRes.json();
        if (!cancelled) {
          setUser(unwrap(userBody));
          if (branchesRes?.ok) {
            const branchBody = await branchesRes.json();
            setBranches(unwrap(branchBody) || []);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const branchName = (u) => {
    const raw = u.branchId?._id || u.branchId?.id || u.branchId;
    if (typeof u.branchId === 'object') return u.branchId.name || raw;
    const found = branches.find((b) => (b._id || b.id) === raw);
    return found?.name || raw || '—';
  };

  const deptName = (d) => {
    if (!d) return '—';
    if (typeof d === 'object') return d.name || '—';
    return d;
  };

  const roleName = (r) => {
    if (!r) return '—';
    if (typeof r === 'object') return r.name || '—';
    return r;
  };

  const fullName = () => {
    if (!user) return '';
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '';
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/users')}
            className="p-2 rounded-xl hover:bg-gray-200 text-gray-600 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">ລາຍລະອຽດຜູ້ໃຊ້</h1>
            <p className="text-xs text-gray-400">User Profile</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400 gap-2">
            <Loader2 size={16} className="animate-spin" />
            ກຳລັງໂຫຼດ...
          </div>
        ) : user ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-5 flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/90 flex items-center justify-center text-2xl font-bold text-amber-600 shadow-sm">
                {(fullName().charAt(0) || '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{fullName()}</h2>
                <p className="text-sm text-amber-50 flex items-center gap-1.5">
                  <Hash size={13} />
                  {user.employeeCode || '—'}
                </p>
              </div>
              <span className={`ml-auto shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${user.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {user.isActive !== false ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-gray-50 text-gray-500 shrink-0"><Mail size={16} /></span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">ອີເມວ</div>
                  <div className="text-gray-800 truncate">{user.email || '—'}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-gray-50 text-gray-500 shrink-0"><Phone size={16} /></span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">ເບີໂທ</div>
                  <div className="text-gray-800 truncate">{user.phone || 'ບໍ່ມີເບີໂທ'}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-gray-50 text-gray-500 shrink-0"><Shield size={16} /></span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">ສິດທິ (Role)</div>
                  <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-medium">
                    {roleName(user.role)}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-gray-50 text-gray-500 shrink-0"><Building2 size={16} /></span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">ສາຂາ</div>
                  <div className="text-gray-800">{branchName(user)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-gray-50 text-gray-500 shrink-0"><Layers size={16} /></span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">ພະແນກ</div>
                  <div className="text-gray-800">{deptName(user.departmentId)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-gray-50 text-gray-500 shrink-0"><UserRound size={16} /></span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">ລະຫັດພະນັກງານ</div>
                  <div className="text-gray-800">{user.employeeCode || '—'}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-gray-50 text-gray-500 shrink-0"><Calendar size={16} /></span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">ສ້າງບັນຊີເມື່ອ</div>
                  <div className="text-gray-800">{formatDate(user.createdAt)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-gray-50 text-gray-500 shrink-0"><CheckCircle2 size={16} /></span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">ເຂົ້າສູ່ລະບົບລ່າສຸດ</div>
                  <div className="text-gray-800">{formatDate(user.lastLoginAt)}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 p-6 flex justify-end">
              <button
                onClick={() => navigate('/users')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition"
              >
                ກັບໄປຈັດການຜູ້ໃຊ້
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}