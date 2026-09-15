import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MainLayout from '../layouts/MainLayout';
import { Users, Plus, X, Loader2, AlertCircle, Building2, Layers } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  const [formData, setFormData] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    role: '',
    branchId: '',
    departmentId: '',        // ← rename to departmentId
  });

  const getToken = () => localStorage.getItem('token') || '';

  const fetchData = async () => {
    const headers = { Authorization: `Bearer ${getToken()}` };
    try {
      const [userRes, branchRes, deptRes, roleRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/users`, { headers }),
        axios.get(`${API_BASE_URL}/branches`, { headers }),
        axios.get(`${API_BASE_URL}/departments`, { headers }),
        axios.get(`${API_BASE_URL}/roles`, { headers }).catch(() => ({ data: [] }))
      ]);

      setUsers(userRes.data.data || userRes.data || []);
      setBranches(branchRes.data.data || branchRes.data || []);
      setDepartments(deptRes.data.data || deptRes.data || []);
      setRoles(roleRes.data.data || roleRes.data || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      role: '',
      branchId: '',
      departmentId: '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      employeeCode: user.employeeCode || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      password: '',
      phone: user.phone || '',
      role: user.role?._id || user.role?.id || user.role || '',
      branchId: user.branchId?._id || user.branchId?.id || user.branchId || user.branchID?._id || user.branchID?.id || user.branchID || user.branch?._id || user.branch?.id || user.branch || '',
      departmentId: user.departmentId?._id || user.departmentId?.id || user.departmentId || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form Data before submit:', formData);
    setError('');
    setSubmitting(true);

    const headers = { Authorization: `Bearer ${getToken()}` };

    try {
      if (editingUser) {
        const payload = { ...formData };
        if (!payload.password) delete payload.password;

        await axios.patch(`${API_BASE_URL}/users/${editingUser._id || editingUser.id}`, payload, { headers });
        alert('ແກ້ໄຂຂໍ້ມູນຜູ້ໃຊ້ສຳເລັດ!');
      } else {
        await axios.post(`${API_BASE_URL}/users`, formData, { headers });
        alert('ເພີ່ມຜູ້ໃຊ້ສຳເລັດ!');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err.response?.data?.message || err.response?.data?.msg || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('ທ່ານຕ້ອງການລຶບຜູ້ໃຊ້ນີ້ແທ້ບໍ?')) {
      try {
        const headers = { Authorization: `Bearer ${getToken()}` };
        await axios.delete(`${API_BASE_URL}/users/${id}`, { headers });
        alert('ລົບຜູ້ໃຊ້ສຳເລັດ!');
        fetchData();
      } catch (err) {
        console.error('Error deleting user:', err);
        alert(err.response?.data?.message || 'ບໍ່ສາມາດລຶບຜູ້ໃຊ້ໄດ້');
      }
    }
  };

  const getBranchName = (b) => {
    if (typeof b === 'object') return b?.name;
    const found = branches.find(item => (item._id === b || item.id === b));
    return found?.name || '-';
  };

  const getDepartmentName = (d) => {
    if (typeof d === 'object') return d?.name;
    const found = departments.find(item => (item._id === d || item.id === d));
    return found?.name || '-';
  };

  const getRoleName = (r) => {
    if (typeof r === 'object') return r?.name;
    const found = roles.find(item => (item._id === r || item.id === r));
    return found?.name || r || 'USER';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຈັດການຜູ້ໃຊ້ (Users Management)</h1>
            <p className="text-sm text-gray-500 mt-1">ຈັດການຂໍ້ມູນພະນັກງານ, ສາຂາ, ພະແນກ ແລະ ສິດທິການໃຊ້ງານ</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus size={18} />
            <span>ເພີ່ມຜູ້ໃຊ້</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດ / ຊື່-ນາມສະກຸນ</th>
                <th className="p-4 font-medium">ອີເມວ / ເບີໂທ</th>
                <th className="p-4 font-medium">ສາຂາ / ພະແນກ</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
                <th className="p-4 font-medium text-center">ຈັດການ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td>
                </tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr key={user._id || user.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-gray-400">ລະຫັດ: {user.employeeCode}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-gray-900">{user.email}</div>
                      <div className="text-xs text-gray-400">{user.phone || 'ບໍ່ມີເບີໂທ'}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800 flex items-center gap-1">
                        <Building2 size={14} className="text-amber-500" />
                        {getBranchName(user.branchId || user.branchID || user.branch)}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Layers size={14} className="text-gray-400" />
                        {getDepartmentName(user.departmentId)}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-medium">
                        {getRoleName(user.role)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {user.isActive !== false ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition shadow-sm"
                        >
                          ແກ້ໄຂ
                        </button>
                        <button
                          onClick={() => handleDelete(user._id || user.id)}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition shadow-sm"
                        >
                          ລົບ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-sm text-gray-400">ຍັງບໍ່ມີຂໍ້ມູນຜູ້ໃຊ້ໃນລະບົບ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden border border-gray-100 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Users className="text-amber-500" size={20} />
                {editingUser ? 'ແກ້ໄຂຂໍ້ມູນຜູ້ໃຊ້' : 'ເພີ່ມຜູ້ໃຊ້ໃໝ່'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ລະຫັດພະນັກງານ (Employee Code)</label>
                  <input
                    type="text"
                    required
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ສິດທິຜູ້ໃຊ້ (Role)</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="">-- ເລືອກ Role --</option>
                    {roles.map((r) => (
                      <option key={r._id || r.id} value={r._id || r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ຊື່ (First Name)</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ນາມສະກຸນ (Last Name)</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ອີເມວ (Email)</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ລະຫັດຜ່ານ {editingUser && <span className="text-gray-400 text-[10px]">(ປ່ອຍຫວ່າງຖ້າບໍ່ປ່ຽນ)</span>}
                  </label>
                  <input
                    type="password"
                    {...(!editingUser && { required: true, minLength: 8 })}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? '********' : 'ຢ່າງໜ້ອຍ 8 ຕົວ'}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ເບີໂທລະສັບ (Phone)</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ສາຂາ (Branch)</label>
                  <select
                    required
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="">-- ເລືອກສາຂາ --</option>
                    {branches.map((b) => (
                      <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ພະແນກ (Department)</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="">-- ເລືອກພະແນກ --</option>
                    {departments.map((d) => (
                      <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                  ຍົກເລີກ
                </button>
                <button type="submit" disabled={submitting} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50">
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  <span>{editingUser ? 'ບັນທຶກການແກ້ໄຂ' : 'ບັນທຶກຜູ້ໃຊ້'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}