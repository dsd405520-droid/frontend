import { useState, useEffect } from 'react';
import { Plus, AlertTriangle, X, Clock, CheckCircle, XCircle } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';

export default function AssetManagement() {
  const canCreateCatalog = hasPermission('supplies', 'create');
  const canApproveRequests = hasPermission('supplies', 'approve');

  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'pending'
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    stockQty: 0,
    lowStockThreshold: 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // States ສຳລັບ Pending Supply Requests (ຄຳຂໍລໍຖ້າອະນຸມັດ)
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingError, setPendingError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const url = lowStockOnly ? '/supply-catalog?lowStockOnly=true' : '/supply-catalog';
      const response = await api.get(url);
      
      // ຈັດການແຍກໂຄງສ້າງ Response ທີ່ຖືກຫໍ່ດ້ວຍ Interceptor (ຮອງຮັບທັງ Array ໂດຍກົງ ແລະ nested data)
      const responseData = response.data;
      let items = [];
      if (Array.isArray(responseData)) {
        items = responseData;
      } else if (responseData && Array.isArray(responseData.data)) {
        items = responseData.data;
      } else if (responseData && typeof responseData === 'object') {
        // ຖ້າມີ property ອື່ນທີ່ເກັບ Array ໄວ້
        const foundArrayKey = Object.keys(responseData).find(key => Array.isArray(responseData[key]));
        if (foundArrayKey) {
          items = responseData[foundArrayKey];
        }
      }

      setAssets(items);
    } catch (error) {
      console.error('Failed to fetch supply catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  // ຄຳຂໍເບີກອຸປະກອນທັງໝົດທີ່ຍັງ "REQUESTED" (ລໍຖ້າອະນຸມັດ) — ໃຫ້ຄົນຮັບຜິດຊອບອະນຸມັດ/ປະຕິເສດ
  const fetchPendingRequests = async () => {
    try {
      setLoadingPending(true);
      setPendingError('');
      const response = await api.get('/supply-requests?status=REQUESTED');

      const responseData = response.data;
      let allRequests = [];
      if (Array.isArray(responseData)) {
        allRequests = responseData;
      } else if (responseData && Array.isArray(responseData.data)) {
        allRequests = responseData.data;
      } else if (responseData && typeof responseData === 'object') {
        const foundArrayKey = Object.keys(responseData).find(key => Array.isArray(responseData[key]));
        if (foundArrayKey) {
          allRequests = responseData[foundArrayKey];
        }
      }

      setPendingRequests(allRequests);
    } catch (error) {
      console.error('Failed to fetch supply requests:', error);
      const status = error.response?.status;
      if (status === 403) {
        setPendingError('ບັນຊີນີ້ບໍ່ມີສິດອະນຸມັດຄຳຂໍອຸປະກອນ (supplies:approve)');
      } else if (status === 401) {
        setPendingError('Session ໝົດອາຍຸ — ກະລຸນາ login ໃໝ່');
      } else {
        setPendingError(error.response?.data?.message || 'ບໍ່ສາມາດດຶງຄຳຂໍລໍຖ້າອະນຸມັດໄດ້');
      }
      setPendingRequests([]);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowStockOnly]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPendingRequests();
  }, []);

  const handleApprove = async (id) => {
    try {
      setReviewingId(id);
      await api.patch(`/supply-requests/${id}/approve`);
      await fetchPendingRequests();
      // ຖ້າ workflow ຂອງອ້າຍຫັກສະຕັອກທັນທີຕອນອະນຸມັດ, refresh catalog ນຳ
      fetchCatalog();
    } catch (error) {
      alert(error.response?.data?.message || 'ອະນຸມັດບໍ່ສຳເລັດ');
    } finally {
      setReviewingId(null);
    }
  };

  // Backend ບັງຄັບໃຫ້ມີ "reason" ຕອນປະຕິເສດ (RejectSupplyRequestDto.reason ເປັນ required)
  // ຈຶ່ງຕ້ອງຖາມເຫດຜົນກ່ອນສົ່ງ request, ບໍ່ດັ່ງນັ້ນຈະໄດ້ 400 Bad Request ທຸກຄັ້ງ
  const handleReject = async (id) => {
    const reason = window.prompt('ກະລຸນາລະບຸເຫດຜົນທີ່ປະຕິເສດຄຳຂໍນີ້:');
    if (reason === null) return; // ຜູ້ໃຊ້ກົດ Cancel
    if (!reason.trim()) {
      alert('ຕ້ອງລະບຸເຫດຜົນຈຶ່ງຈະປະຕິເສດໄດ້');
      return;
    }
    try {
      setReviewingId(id);
      await api.patch(`/supply-requests/${id}/reject`, { reason: reason.trim() });
      await fetchPendingRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'ປະຕິເສດບໍ່ສຳເລັດ');
    } finally {
      setReviewingId(null);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'stockQty' || name === 'lowStockThreshold' ? Number(value) : value,
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg('');
      await api.post('/supply-catalog', formData);
      setIsModalOpen(false);
      // Reset form
      setFormData({ name: '', category: '', unit: '', stockQty: 0, lowStockThreshold: 5 });
      fetchCatalog(); // Refresh list
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກຂໍ້ມູນ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຈັດການລາຍການອຸປະກອນ (Supply Catalog)</h1>
            <p className="text-sm text-gray-500 mt-1">ທະບຽນ ແລະ ຕິດຕາມສະຕັອກອຸປະກອນສຳນັກງານ</p>
          </div>
          {activeTab === 'catalog' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLowStockOnly(!lowStockOnly)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 border ${
                  lowStockOnly 
                    ? 'bg-red-50 text-red-600 border-red-200' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <AlertTriangle size={16} />
                <span>{lowStockOnly ? 'ສະແດງທັງໝົດ' : 'ສະຕັອກໃກ້ໝົດ'}</span>
              </button>
              {canCreateCatalog && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={18} />
                  <span>ເພີ່ມລາຍການໃໝ່</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* TAB BAR */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'catalog' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ລາຍການອຸປະກອນ (Catalog)
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${activeTab === 'pending' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span>ຄຳຂໍອຸປະກອນຈາກພະແນກ</span>
            {pendingRequests.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB: PENDING SUPPLY REQUESTS — ຄຳຂໍທີ່ລໍຖ້າອະນຸມັດ */}
        {activeTab === 'pending' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              <h2 className="font-bold text-gray-800">ຄຳຂໍອຸປະກອນທີ່ລໍຖ້າອະນຸມັດ</h2>
            </div>
            {pendingRequests.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                {pendingRequests.length} ລາຍການ
              </span>
            )}
          </div>

          {loadingPending ? (
            <div className="py-10 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
          ) : pendingError ? (
            <div className="py-10 text-center text-sm text-red-500 px-4">⚠️ {pendingError}</div>
          ) : pendingRequests.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {pendingRequests.map((req) => {
                const requesterName =
                  req.requestedBy?.name || req.requestedBy?.email ||
                  req.userId?.name || req.userId?.email ||
                  req.createdBy?.name || 'ບໍ່ລະບຸຜູ້ຂໍ';
                const totalQty = Array.isArray(req.items) ? req.items.reduce((sum, i) => sum + (i.quantity || 0), 0) : 0;

                return (
                  <div key={req._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800">{req._id}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{totalQty} ຊິ້ນ</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {Array.isArray(req.items) && req.items.map((i, idx) => (
                          <div key={idx}>• {i.name} (x{i.quantity}){i.reason ? ` — ${i.reason}` : ''}</div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        ຜູ້ຂໍ: {requesterName} · ວັນທີຍື່ນ: {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canApproveRequests ? (
                        <>
                          <button
                            onClick={() => handleApprove(req._id)}
                            disabled={reviewingId === req._id}
                            className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle size={14} />
                            <span>{reviewingId === req._id ? 'ກຳລັງດຳເນີນການ...' : 'ອະນຸມັດ'}</span>
                          </button>
                          <button
                            onClick={() => handleReject(req._id)}
                            disabled={reviewingId === req._id}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle size={14} />
                            <span>ປະຕິເສດ</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">ບໍ່ມີສິດອະນຸມັດ</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-gray-400">ບໍ່ມີຄຳຂໍລໍຖ້າອະນຸມັດ</div>
          )}
        </div>
        )}

        {/* TAB: CATALOG */}
        {activeTab === 'catalog' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດ (_id)</th>
                <th className="p-4 font-medium">ຊື່ລາຍການ</th>
                <th className="p-4 font-medium">ໝວດໝູ່</th>
                <th className="p-4 font-medium">ຫົວໜ່ວຍ</th>
                <th className="p-4 font-medium">ຈຳນວນຄົງເຫຼືອ (Stock)</th>
                <th className="p-4 font-medium">ຈຳນວນຂັ້ນຕ່ຳ</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-sm text-gray-400">
                    ກຳລັງໂຫຼດຂໍ້ມູນ...
                  </td>
                </tr>
              ) : assets.length > 0 ? (
                assets.map((item) => {
                  const isLowStock = item.stockQty <= item.lowStockThreshold;
                  return (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="p-4 font-semibold text-gray-900">{item._id}</td>
                      <td className="p-4 font-medium text-gray-800">{item.name}</td>
                      <td className="p-4">{item.category}</td>
                      <td className="p-4">{item.unit}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {item.stockQty}
                        </span>
                      </td>
                      <td className="p-4">{item.lowStockThreshold}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.isActive ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-sm text-gray-400">
                    ບໍ່ມີຂໍ້ມູນລາຍການອຸປະກອນ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Create Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">ເພີ່ມລາຍການອຸປະກອນໃໝ່</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຊື່ລາຍການ (Name)</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="ເຊັ່ນ: ບີກສີຟ້າ (ສີຟ້າ)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ໝວດໝູ່ (Category)</label>
                <input
                  type="text"
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleInputChange}
                  placeholder="ເຊັ່ນ: ເຄື່ອງຂຽນ"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຫົວໜ່ວຍ (Unit)</label>
                <input
                  type="text"
                  name="unit"
                  required
                  value={formData.unit}
                  onChange={handleInputChange}
                  placeholder="ເຊັ່ນ: ດ້າມ, ກອ່ງ, ເເພັກ"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ຈຳນວນເລີ່ມຕົ້ນ (Stock Qty)</label>
                  <input
                    type="number"
                    name="stockQty"
                    min="0"
                    required
                    value={formData.stockQty}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ຈຳນວນເຕືອນຂັ້ນຕຳ່ (Threshold)</label>
                  <input
                    type="number"
                    name="lowStockThreshold"
                    min="0"
                    required
                    value={formData.lowStockThreshold}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກຂໍ້ມູນ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}