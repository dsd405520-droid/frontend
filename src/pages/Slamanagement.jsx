import React, { useState, useEffect } from 'react';
import { Clock, Plus, Loader2, X, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

const PRIORITY_KEYWORDS = {
  low: ['low', 'ຕ່ຳ'],
  medium: ['medium', 'ກາງ'],
  high: ['high', 'ສູງ'],
  urgent: ['urgent', 'ດ່ວນ'],
};

const emptyForm = {
  name: '',
  ticketTypeId: '',
  priority: 'medium',
  responseTimeMinutes: 30,
  resolutionTimeMinutes: 240,
  isActive: true,
};

export default function Slamanagement() {
  const [slas, setSlas] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = ກຳລັງສ້າງໃໝ່, ບໍ່ null = ກຳລັງແກ້ໄຂ

  // Form State
  const [formData, setFormData] = useState(emptyForm);

  // State ສຳລັບ Real-time Search ຂອງ Ticket Type (ຄືຮູບແບບໜ້າ Issues.jsx)
  const [typeSearchQuery, setTypeSearchQuery] = useState('');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [selectedTypeName, setSelectedTypeName] = useState('');

  const token = localStorage.getItem('token');

  const extractArrayData = (resData) => {
    if (Array.isArray(resData)) return resData;
    if (resData && Array.isArray(resData.data)) return resData.data;
    if (resData && Array.isArray(resData.policies)) return resData.policies;
    if (resData && Array.isArray(resData.items)) return resData.items;
    return [];
  };

  const fetchSlas = () => {
    setLoading(true);
    fetch('http://localhost:3000/api/sla-policies', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(async res => {
        if (!res.ok) throw new Error('Failed to fetch SLAs');
        return res.json();
      })
      .then(data => {
        setSlas(extractArrayData(data));
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching SLAs:', err);
        setLoading(false);
      });
  };

  const fetchTicketTypes = () => {
    fetch('http://localhost:3000/api/ticket-types', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setTicketTypes(extractArrayData(data)))
      .catch(err => console.error('Error fetching ticket types:', err));
  };

  useEffect(() => {
    fetchSlas();
    fetchTicketTypes();
  }, []);

  const filteredTicketTypes = ticketTypes.filter(type =>
    type.name?.toLowerCase().includes(typeSearchQuery.toLowerCase())
  );

  const handleSelectTicketType = (type) => {
    setSelectedTypeName(type.name);
    setFormData(prev => ({ ...prev, ticketTypeId: type._id || type.id }));
    setIsTypeDropdownOpen(false);
    setTypeSearchQuery('');
  };

  // ກວດວ່າຊື່ນະໂຍບາຍ (ເຊັ່ນ "IT Medium Priority SLA") ມີຄຳທີ່ບົ່ງບອກລະດັບຄວາມສຳຄັນ
  // ຂັດແຍ້ງກັບ priority ທີ່ເລືອກໄວ້ຢູ່ບໍ່ — ຖ້າຂັດແຍ້ງ ໃຫ້ຄືນຄຳເຕືອນ, ຖ້າບໍ່ພົບຄຳໃດເລີຍ (ຫຼືກົງກັນ) ຄືນ null
  const getNamePriorityMismatchWarning = (name, priority) => {
    if (!name) return null;
    const lowerName = name.toLowerCase();

    const mentionedPriorities = Object.entries(PRIORITY_KEYWORDS)
      .filter(([, keywords]) => keywords.some(kw => lowerName.includes(kw)))
      .map(([key]) => key);

    if (mentionedPriorities.length === 0) return null;
    if (mentionedPriorities.includes(priority)) return null;

    return `ຊື່ນະໂຍບາຍນີ້ເບິ່ງຄືວ່າໝາຍເຖິງລະດັບ "${mentionedPriorities.join('/')}" ແຕ່ທ່ານເລືອກລະດັບຄວາມສຳຄັນເປັນ "${priority}" — ກະລຸນາກວດຄືນ`;
  };

  const nameMismatchWarning = getNamePriorityMismatchWarning(formData.name, formData.priority);

  const resetForm = () => {
    setFormData(emptyForm);
    setSelectedTypeName('');
    setTypeSearchQuery('');
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setFormData({
      name: item.name || '',
      ticketTypeId: item.ticketTypeId || '',
      priority: item.priority || 'medium',
      responseTimeMinutes: item.responseTimeMinutes ?? 30,
      resolutionTimeMinutes: item.resolutionTimeMinutes ?? 240,
      isActive: item.isActive ?? true,
    });
    const matchingType = ticketTypes.find(t => (t._id || t.id) === item.ticketTypeId);
    setSelectedTypeName(matchingType?.name || item.ticketTypeId || '');
    setEditingId(item._id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (nameMismatchWarning) {
      const proceed = window.confirm(`${nameMismatchWarning}\n\nຕ້ອງການບັນທຶກຕໍ່ໄປແທ້ບໍ?`);
      if (!proceed) return;
    }

    setSubmitting(true);

    try {
      const isEditing = !!editingId;
      const url = isEditing
        ? `http://localhost:3000/api/sla-policies/${editingId}`
        : 'http://localhost:3000/api/sla-policies';

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        resetForm();
        fetchSlas();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກຂໍ້ມູນ');
      }
    } catch (err) {
      console.error('Error saving SLA:', err);
      alert('ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບເຊີບເວີໄດ້');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`ຕ້ອງການລຶບນະໂຍບາຍ "${item.name}" ແທ້ບໍ?`)) return;

    try {
      const response = await fetch(`http://localhost:3000/api/sla-policies/${item._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchSlas();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'ລຶບບໍ່ສຳເລັດ');
      }
    } catch (err) {
      console.error('Error deleting SLA:', err);
      alert('ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບເຊີບເວີໄດ້');
    }
  };

  const ticketTypeNameById = (id) => {
    const match = ticketTypes.find(t => (t._id || t.id) === id);
    return match?.name || id;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ການຈັດການ SLA</h1>
            <p className="text-sm text-gray-500 mt-1">ກຳນົດນະໂຍບາຍເວລາຕອບກັບ ແລະ ແກ້ໄຂບັນຫາ (NestJS + MongoDB)</p>
          </div>
          <button 
            onClick={openCreateModal}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus size={18} />
            <span>ເພີ່ມນະໂຍບາຍ SLA</span>
          </button>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ຊື່ນະໂຍບາຍ / ID</th>
                <th className="p-4 font-medium">ປະເພດບັນຫາ</th>
                <th className="p-4 font-medium">ລະດັບຄວາມສຳຄັນ</th>
                <th className="p-4 font-medium">ເວລາຕອບກັບ (Response)</th>
                <th className="p-4 font-medium">ເວລາແກ້ໄຂ (Resolution)</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
                <th className="p-4 font-medium text-right">ຈັດການ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-sm text-gray-400">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    ກຳລັງໂຫຼດຂໍ້ມູນ...
                  </td>
                </tr>
              ) : slas.length > 0 ? (
                slas.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-400">{item._id}</div>
                    </td>
                    <td className="p-4 text-xs text-gray-600">{ticketTypeNameById(item.ticketTypeId)}</td>
                    <td className="p-4 uppercase">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                        item.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        item.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="p-4">{item.responseTimeMinutes} ນາທີ</td>
                    <td className="p-4">{item.resolutionTimeMinutes} ນາທີ</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {item.isActive ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-amber-600 transition"
                          title="ແກ້ໄຂ"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                          title="ລຶບ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-sm text-gray-400">
                    ຍັງບໍ່ມີຂໍ້ມູນ SLA
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg">
                {editingId ? 'ແກ້ໄຂນະໂຍບາຍ SLA' : 'ເພີ່ມນະໂຍບາຍ SLA ໃໝ່'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຊື່ນະໂຍບາຍ</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="ເຊັ່ນ: IT High Priority SLA" 
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* ຄົ້ນຫາ ແລະ ເລືອກ Ticket Type ຈາກລາຍການຈິງ ແທນທີ່ຈະພິມ ID ເອງ */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">ປະເພດບັນຫາ (Ticket Type)</label>
                <div
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <span className={selectedTypeName ? "text-gray-800" : "text-gray-400"}>
                    {selectedTypeName || "-- ຄົ້ນຫາ ຫຼື ເລືອກປະເພດບັນຫາ --"}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </div>

                {isTypeDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                      <input
                        type="text"
                        autoFocus
                        value={typeSearchQuery}
                        onChange={(e) => setTypeSearchQuery(e.target.value)}
                        placeholder="ພິມຄົ້ນຫາປະເພດບັນຫາ..."
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                      />
                    </div>
                    <ul className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                      {filteredTicketTypes.length > 0 ? (
                        filteredTicketTypes.map(type => (
                          <li
                            key={type._id || type.id}
                            onClick={() => handleSelectTicketType(type)}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-800 cursor-pointer transition"
                          >
                            {type.name}
                          </li>
                        ))
                      ) : (
                        <li className="px-3 py-4 text-center text-xs text-gray-400">
                          ບໍ່ພົບປະເພດບັນຫາທີ່ຄົ້ນຫາ
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ລະດັບຄວາມສຳຄັນ (Priority)</label>
                <select 
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {nameMismatchWarning && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ {nameMismatchWarning}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ເວລາຕອບກັບ (ນາທີ)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={formData.responseTimeMinutes}
                    onChange={(e) => setFormData({...formData, responseTimeMinutes: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ເວລາແກ້ໄຂ (ນາທີ)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={formData.resolutionTimeMinutes}
                    onChange={(e) => setFormData({...formData, resolutionTimeMinutes: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700 font-medium">ເປີດໃຊ້ງານທັນທີ</label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  ຍົກເລີກ
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  <span>{editingId ? 'ບັນທຶກການແກ້ໄຂ' : 'ບັນທຶກ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}