import { useState, useEffect } from 'react';
import { Building2, Layers, Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';

export default function BranchesManagement() {
  const canCreateBranch = hasPermission('branches', 'create');
  const canCreateDept = hasPermission('departments', 'create');

  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // States ສຳລັບ Modal ເພີ່ມສາຂາ
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [submittingBranch, setSubmittingBranch] = useState(false);
  const [branchError, setBranchError] = useState('');
  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    city: '',
    country: 'Laos',
    timezone: 'Asia/Vientiane',
    isActive: true,
  });

  // States ສຳລັບ Modal ເພີ່ມພະແນກ
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [submittingDept, setSubmittingDept] = useState(false);
  const [deptError, setDeptError] = useState('');
  const [deptForm, setDeptForm] = useState({
    branchId: '',
    name: '',
    managerIds: '',
    isActive: true,
  });

  // ດຶງຂໍ້ມູນທັງສາຂາ ແລະ ພະແນກ
  const fetchData = async () => {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [branchRes, deptRes] = await Promise.all([
        fetch('http://localhost:3000/api/branches', { headers }),
        fetch('http://localhost:3000/api/departments', { headers })
      ]);

      const branchData = await branchRes.json();
      const deptData = await deptRes.json();

      if (Array.isArray(branchData)) {
        setBranches(branchData);
      } else if (branchData && Array.isArray(branchData.data)) {
        setBranches(branchData.data);
      }

      if (Array.isArray(deptData)) {
        setDepartments(deptData);
      } else if (deptData && Array.isArray(deptData.data)) {
        setDepartments(deptData.data);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // ຈັດການບັນທຶກສາຂາ
  const handleBranchSubmit = async (e) => {
    e.preventDefault();
    setBranchError('');
    setSubmittingBranch(true);

    const token = localStorage.getItem('token');
    const payload = {
      name: branchForm.name,
      location: {
        address: branchForm.address,
        city: branchForm.city,
        country: branchForm.country,
        timezone: branchForm.timezone,
      },
      isActive: branchForm.isActive,
    };

    try {
      const response = await fetch('http://localhost:3000/api/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'ບໍ່ສາມາດເພີ່ມສາຂາໄດ້');
      }

      setIsBranchModalOpen(false);
      setBranchForm({
        name: '',
        address: '',
        city: '',
        country: 'Laos',
        timezone: 'Asia/Vientiane',
        isActive: true,
      });
      fetchData();
    } catch (err) {
      setBranchError(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    } finally {
      setSubmittingBranch(false);
    }
  };

  // ຈັດການບັນທຶກພະແນກ
  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    setDeptError('');
    setSubmittingDept(true);

    const token = localStorage.getItem('token');
    const formattedManagerIds = deptForm.managerIds
      ? deptForm.managerIds.split(',').map(id => id.trim()).filter(Boolean)
      : [];

    const payload = {
      branchId: deptForm.branchId,
      name: deptForm.name,
      managerIds: formattedManagerIds,
      isActive: deptForm.isActive,
    };

    try {
      const response = await fetch('http://localhost:3000/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'ບໍ່ສາມາດເພີ່ມພະແນກໄດ້');
      }

      setIsDeptModalOpen(false);
      setDeptForm({
        branchId: '',
        name: '',
        managerIds: '',
        isActive: true,
      });
      fetchData();
    } catch (err) {
      setDeptError(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    } finally {
      setSubmittingDept(false);
    }
  };

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b._id === branchId);
    return branch ? branch.name : branchId;
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ສາຂາ ແລະ ພະແນກ</h1>
            <p className="text-sm text-gray-500 mt-1">ຈັດການຂໍ້ມູນສາຂາ, ພະແນກ ແລະ ເວລາເຮັດວຽກ</p>
          </div>
          <div className="flex items-center gap-3">
            {canCreateBranch && (
              <button 
                onClick={() => setIsBranchModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus size={18} />
                <span>ເພີ່ມສາຂາ</span>
              </button>
            )}
            {canCreateDept && (
              <button 
                onClick={() => setIsDeptModalOpen(true)}
                className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus size={18} />
                <span>ເພີ່ມພະແນກ</span>
              </button>
            )}
          </div>
        </div>

        {/* ตารางສາຂາ */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Building2 size={20} className="text-amber-500" />
            ລາຍຊື່ສາຂາທັງໝົດ
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                  <th className="p-4 font-medium">ຊື່ສາຂາ (ID)</th>
                  <th className="p-4 font-medium">ທີ່ຕັ້ງ (ເມືອງ/ປະເທດ)</th>
                  <th className="p-4 font-medium">Timezone</th>
                  <th className="p-4 font-medium">ສະຖານະ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td>
                  </tr>
                ) : branches.length > 0 ? (
                  branches.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-semibold text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-400">ID: {item._id}</div>
                      </td>
                      <td className="p-4">
                        {item.location ? `${item.location.city}, ${item.location.country}` : '-'}
                      </td>
                      <td className="p-4 text-xs text-gray-500">{item.location?.timezone || '-'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {item.isActive ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-sm text-gray-400">ຍັງບໍ່ມີຂໍ້ມູນສາຂາ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ตารางພະແນກ */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Layers size={20} className="text-amber-500" />
            ລາຍຊື່ພະແນກທັງໝົດ
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                  <th className="p-4 font-medium">ຊື່ພະແນກ (ID)</th>
                  <th className="p-4 font-medium">ສາຂາທີ່สังกัด</th>
                  <th className="p-4 font-medium">Manager IDs</th>
                  <th className="p-4 font-medium">ສະຖານະ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td>
                  </tr>
                ) : departments.length > 0 ? (
                  departments.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-semibold text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-400">ID: {item._id}</div>
                      </td>
                      <td className="p-4 font-medium text-gray-800">
                        {getBranchName(item.branchId)}
                      </td>
                      <td className="p-4 text-xs text-gray-500">
                        {item.managerIds && item.managerIds.length > 0 ? item.managerIds.join(', ') : 'ຍັງບໍ່ມີຜູ້ຈັດການ'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {item.isActive ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-sm text-gray-400">ຍັງບໍ່ມີຂໍ້ມູນພະແນກ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal ເພີ່ມສາຂາ */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Building2 className="text-amber-500" size={20} />
                ເພີ່ມສາຂາໃໝ່
              </h3>
              <button onClick={() => setIsBranchModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBranchSubmit} className="p-6 space-y-4">
              {branchError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{branchError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຊື່ສາຂາ (Branch Name)</label>
                <input
                  type="text"
                  required
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  placeholder="ຕົວຢ່າງ: APB Saysettha Branch"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ທີ່ຢູ່ (Address)</label>
                <input
                  type="text"
                  required
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  placeholder="ຕົວຢ່າງ: T2 Road, Phonxay Village"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ເມືອງ/ແຂວງ (City)</label>
                  <input
                    type="text"
                    required
                    value={branchForm.city}
                    onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                    placeholder="ຕົວຢ່າງ: Vientiane"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ປະເທດ (Country)</label>
                  <input
                    type="text"
                    required
                    value={branchForm.country}
                    onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })}
                    placeholder="ຕົວຢ່າງ: Laos"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
                <input
                  type="text"
                  required
                  value={branchForm.timezone}
                  onChange={(e) => setBranchForm({ ...branchForm, timezone: e.target.value })}
                  placeholder="Asia/Vientiane"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="branchIsActive"
                  checked={branchForm.isActive}
                  onChange={(e) => setBranchForm({ ...branchForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-500 border-gray-300 rounded"
                />
                <label htmlFor="branchIsActive" className="text-sm text-gray-700 font-medium">ເປີດໃຊ້ງານທັນທີ</label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsBranchModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                  ຍົກເລີກ
                </button>
                <button type="submit" disabled={submittingBranch} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50">
                  {submittingBranch && <Loader2 className="animate-spin" size={16} />}
                  <span>ບັນທຶກສາຂາ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ເພີ່ມພະແນກ */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Layers className="text-amber-500" size={20} />
                ເພີ່ມພະແນກໃໝ່
              </h3>
              <button onClick={() => setIsDeptModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDeptSubmit} className="p-6 space-y-4">
              {deptError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{deptError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ເລືອກສາຂາ (Branch)</label>
                <select
                  required
                  value={deptForm.branchId}
                  onChange={(e) => setDeptForm({ ...deptForm, branchId: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 bg-white"
                >
                  <option value="">-- ກະລຸນາເລືອກສາຂາ --</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b._id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຊື່ພະແນກ (Department Name)</label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="ຕົວຢ່າງ: IT Support"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Manager IDs (ຂັ້ນດ້ວຍເຄື່ອງໝາຍຈຸດ ,)</label>
                <input
                  type="text"
                  value={deptForm.managerIds}
                  onChange={(e) => setDeptForm({ ...deptForm, managerIds: e.target.value })}
                  placeholder="ຕົວຢ່າງ: U010, U011"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="deptIsActive"
                  checked={deptForm.isActive}
                  onChange={(e) => setDeptForm({ ...deptForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-500 border-gray-300 rounded"
                />
                <label htmlFor="deptIsActive" className="text-sm text-gray-700 font-medium">ເປີດໃຊ້ງານທັນທີ</label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsDeptModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                  ຍົກເລີກ
                </button>
                <button type="submit" disabled={submittingDept} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50">
                  {submittingDept && <Loader2 className="animate-spin" size={16} />}
                  <span>ບັນທຶກພະແນກ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}