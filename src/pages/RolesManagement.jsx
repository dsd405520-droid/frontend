import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MainLayout from '../layouts/MainLayout';
import { Shield, Plus, X, Loader2, AlertCircle, Lock, Check } from 'lucide-react';
import { hasPermission } from '../utils/permissions';

const API_BASE_URL = 'http://localhost:3000/api';

const AVAILABLE_MODULES = [
  { key: 'users', label: 'ຈັດການຜູ້ໃຊ້ (Users)' },
  { key: 'roles', label: 'ຈັດການສິດ (Roles)' },
  { key: 'branches', label: 'ສາຂາ (Branches)' },
  { key: 'departments', label: 'ພະແນກ (Departments)' },
  { key: 'sessions', label: 'ຈັດການ Session ຜູ້ໃຊ້ (Sessions)' },
  { key: 'assets', label: 'ຈັດການຊັບສິນ (Assets)' },
  { key: 'tickets', label: 'ລະບົບແຈ້ງປັນຫາ (Tickets)' },
  { key: 'ticket-types', label: 'ປະເພດບັນຫາ (Ticket Types)' },
  { key: 'sla', label: 'ການຈັດການ SLA' },
  { key: 'kb', label: 'ຖານຂໍ້ມູນຄວາມຮູ້ (Knowledge Base)' },
  { key: 'rooms', label: 'ຈອງຫ້ອງປະຊຸມ (Meeting Rooms)' },
  { key: 'supplies', label: 'ຂໍອຸປະກອນສິ້ນເປືອງ (Supplies)' },
  { key: 'announcements', label: 'ປະກາດ (Announcements)' },
  { key: 'reports', label: 'ບົດລາຍງານ (Reports)' },
  { key: 'audit-logs', label: 'ບັນທຶກການກວດສອບ (Audit Logs)' },
  { key: 'settings', label: 'ການຕັ້ງຄ່າອົງກອນ (Settings)' },
];

// ໝາຍເຫດ: module key ຕ້ອງກົງກັບ string ທີ່ backend ໃຊ້ໃນ @RequirePermission(module, action)
// ຢ່າແກ້ key ພວກນີ້ໂດຍບໍ່ກວດ backend controller ກ່ອນ — ບໍ່ດັ່ງນັ້ນ permission ຈະບໍ່ກົງກັນ ແລະ guard ຈະບລັອກທຸກຄົນ

const AVAILABLE_ACTIONS = [
  { key: 'create', label: 'ສ້າງ (Create)' },
  { key: 'read', label: 'ອ່ານ/ເບິ່ງ (Read)' },
  { key: 'update', label: 'ແກ້ໄຂ (Update)' },
  { key: 'delete', label: 'ລົບ (Delete)' },
  { key: 'approve', label: 'ອະນຸມັດ (Approve)' },
  { key: 'assign', label: 'ມອບໝາຍ (Assign)' },
  { key: 'fulfill', label: 'ຮັບເຄື່ອງ (Fulfill)' },
  { key: 'publish', label: 'ເຜີຍແຜ່ (Publish)' },
  { key: 'export', label: 'ສົ່ງອອກ (Export)' },
];

export default function RolesManagement() {
  // ຕົວຢ່າງການກວດສິດລະດັບ action (ບໍ່ແມ່ນແຄ່ລະດັບໜ້າ) — ຄົນທີ່ເຂົ້າໜ້ານີ້ໄດ້ (read)
  // ອາດຈະບໍ່ມີສິດ create/update/delete ກໍ່ໄດ້, ຈຶ່ງຕ້ອງເຊັກແຍກແຕ່ລະປຸ່ມ
  const canCreate = hasPermission('roles', 'create');
  const canUpdate = hasPermission('roles', 'update');
  const canDelete = hasPermission('roles', 'delete');

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingRole, setEditingRole] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    permissions: [], // Format: [{ module: 'users', actions: ['read', 'create'] }]
    mfaRequired: false,
  });

  const getToken = () => localStorage.getItem('token') || '';

  const fetchRoles = async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const res = await axios.get(`${API_BASE_URL}/roles`, { headers });
      setRoles(res.data.data || res.data || []);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      permissions: [],
      mfaRequired: false,
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name || '',
      permissions: role.permissions || [],
      mfaRequired: role.mfaRequired || false,
    });
    setError('');
    setIsModalOpen(true);
  };

  // ຈັດການການຕິກເລືອກ Permission (Module & Actions)
  const handlePermissionChange = (moduleKey, actionKey) => {
    setFormData((prev) => {
      const existingModuleIndex = prev.permissions.findIndex((p) => p.module === moduleKey);
      
      let updatedPermissions = [...prev.permissions];

      if (existingModuleIndex > -1) {
        const currentActions = updatedPermissions[existingModuleIndex].actions;
        if (currentActions.includes(actionKey)) {
          // ຖ້າມີແລ້ວ -> ເອົາອອກ
          const newActions = currentActions.filter((a) => a !== actionKey);
          if (newActions.length === 0) {
            updatedPermissions.splice(existingModuleIndex, 1); // ຖ້າບໍ່ມີ Action ເຫຼືອເລີຍ ໃຫ້ລົບ Module ນັ້ນອອກ
          } else {
            updatedPermissions[existingModuleIndex] = {
              ...updatedPermissions[existingModuleIndex],
              actions: newActions,
            };
          }
        } else {
          // ຖ້າຍັງບໍ່ມີ -> ເພີ່ມເຂົ້າໄປ
          updatedPermissions[existingModuleIndex] = {
            ...updatedPermissions[existingModuleIndex],
            actions: [...currentActions, actionKey],
          };
        }
      } else {
        // ຖ້າຍັງບໍ່ເຄີຍມີ Module ນี้ເລີຍ -> ສ້າງໃໝ່
        updatedPermissions.push({ module: moduleKey, actions: [actionKey] });
      }

      return { ...prev, permissions: updatedPermissions };
    });
  };

  const isActionChecked = (moduleKey, actionKey) => {
    const mod = formData.permissions.find((p) => p.module === moduleKey);
    return mod ? mod.actions.includes(actionKey) : false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const headers = { Authorization: `Bearer ${getToken()}` };

    try {
      if (editingRole) {
        await axios.patch(`${API_BASE_URL}/roles/${editingRole._id}`, formData, { headers });
        alert('ແກ້ໄຂ Role ສຳເລັດ!');
      } else {
        await axios.post(`${API_BASE_URL}/roles`, formData, { headers });
        alert('ເພີ່ມ Role ສຳເລັດ!');
      }
      setIsModalOpen(false);
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.message || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('ທ່ານຕ້ອງການລຶບ Role ນີ້ແທ້ບໍ?')) {
      try {
        const headers = { Authorization: `Bearer ${getToken()}` };
        await axios.delete(`${API_BASE_URL}/roles/${id}`, { headers });
        alert('ລົບ Role ສຳເລັດ!');
        fetchRoles();
      } catch (err) {
        alert(err.response?.data?.message || 'ບໍ່ສາມາດລົບ Role ນີ້ໄດ້');
      }
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຈັດການສິດ ແລະ ບົດບາດ (Roles Management)</h1>
            <p className="text-sm text-gray-500 mt-1">ກຳນົດສິດທິການເຂົ້າເຖິງໂມດູນຕ່າງໆຕາມໂຄງສ້າງ Backend</p>
          </div>
          {canCreate && (
            <button 
              onClick={handleOpenCreate}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span>ເພີ່ມ Role ໃໝ່</span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດ / ຊື່ Role</th>
                <th className="p-4 font-medium">ປະເພດ</th>
                <th className="p-4 font-medium">ສິດທິການໃຊ້ງານ (Permissions)</th>
                <th className="p-4 font-medium text-center">ຈັດການ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr><td colSpan="4" className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td></tr>
              ) : roles.length > 0 ? (
                roles.map((role) => (
                  <tr key={role._id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        <Shield size={16} className="text-amber-500" />
                        {role.name}
                      </div>
                      <div className="text-xs text-gray-400">ID: {role._id}</div>
                    </td>
                    <td className="p-4">
                      {role.isSystemRole ? (
                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          <Lock size={12} /> System Role
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg text-xs font-medium">
                          Custom Role
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {role.permissions && role.permissions.length > 0 ? (
                          role.permissions.map((p, idx) => (
                            <span key={idx} className="bg-amber-50 text-amber-800 border border-amber-200/60 px-2 py-0.5 rounded text-xs font-medium">
                              <strong className="text-amber-900">{p.module}</strong>: [{p.actions.join(', ')}]
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">ບໍ່ມີສິດທິພິເສດ</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canUpdate && (
                          <button 
                            onClick={() => handleOpenEdit(role)} 
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition shadow-sm"
                          >
                            ແກ້ໄຂ
                          </button>
                        )}
                        {canDelete && !role.isSystemRole && (
                          <button 
                            onClick={() => handleDelete(role._id)} 
                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition shadow-sm"
                          >
                            ລົບ
                          </button>
                        )}
                        {!canUpdate && !canDelete && (
                          <span className="text-xs text-gray-400">ອ່ານໄດ້ຢ່າງດຽວ</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" className="py-12 text-center text-sm text-gray-400">ຍັງບໍ່ມີຂໍ້ມູນ Role ໃນລະບົບ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form ສຳລັບ ເພີ່ມ / ແກ້ໄຂ Role */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-100 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Shield className="text-amber-500" size={20} />
                {editingRole ? 'ແກ້ໄຂ Role' : 'ເພີ່ມ Role ໃໝ່'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຊື່ Role (ຕົວຢ່າງ: REGIONAL_COORDINATOR)</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })} 
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 font-semibold"
                  placeholder="USER_ROLE_NAME"
                />
              </div>

              {/* Matrix ກຳນົດ Permissions ຕາມ Module ແລະ Actions */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">ກຳນົດສິດທິການເຂົ້າເຖິງແຕ່ລະໂມດູນ (Permissions)</label>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="p-3 font-semibold">ໂມດູນ</th>
                        {AVAILABLE_ACTIONS.map((action) => (
                          <th key={action.key} className="p-3 font-semibold text-center">{action.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {AVAILABLE_MODULES.map((mod) => (
                        <tr key={mod.key} className="hover:bg-gray-50/50">
                          <td className="p-3 font-medium text-gray-800">{mod.label}</td>
                          {AVAILABLE_ACTIONS.map((action) => {
                            const checked = isActionChecked(mod.key, action.key);
                            return (
                              <td key={action.key} className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handlePermissionChange(mod.key, action.key)}
                                  className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MFA Required Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="mfaRequired"
                  checked={formData.mfaRequired}
                  onChange={(e) => setFormData({ ...formData, mfaRequired: e.target.checked })}
                  className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="mfaRequired" className="text-sm text-gray-700 select-none cursor-pointer">
                  ຕ້ອງການຢືນຢັນຕົວຕົນສອງຊັ້ນ (MFA Required) ສຳລັບ Role ນີ້
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                  ຍົກເລີກ
                </button>
                <button type="submit" disabled={submitting} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50">
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  <span>{editingRole ? 'ບັນທຶກການແກ້ໄຂ' : 'ບັນທຶກ Role ໃໝ່'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}