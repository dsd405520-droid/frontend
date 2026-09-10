import React, { useState, useEffect } from 'react';
import { Package, Plus, CheckCircle, Clock, XCircle } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import axios from '../services/api';

export default function InventorySupplies() {
  const [requests, setRequests] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [items, setItems] = useState([{ catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqRes, catRes] = await Promise.all([
        axios.get('/supply-requests/my'),
        axios.get('/supply-catalog')
      ]);
      
      const reqData = reqRes.data;
      setRequests(Array.isArray(reqData) ? reqData : (reqData.data || reqData.requests || reqData.items || []));

      const catData = catRes.data;
      setCatalog(Array.isArray(catData) ? catData : (catData.data || catData.items || []));
    } catch (err) {
      console.error('Failed to fetch supply data', err);
      setRequests([]);
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddItem = () => {
    setItems([...items, { catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    if (field === 'catalogItemId' && value) {
      const selectedCat = catalog.find(c => c._id === value);
      if (selectedCat) {
        newItems[index].name = selectedCat.name;
      }
    }
    
    setItems(newItems);
  };

  // ຊ່ອງຄົ້ນຫາ+ເລືອກ Catalog — ໃຊ້ <input list> (datalist) ຄົ້ນຫາຊື່ໄດ້ ເຖິງມີເປັນຮ້ອຍລາຍການ.
  // ເມື່ອຄ່າທີ່ພິມ/ເລືອກກົງກັບຊື່ໃນ Catalog ພໍດີ (ເລືອກຈາກ dropdown ຫຼືພິມຄົບຊື່) ຈຶ່ງຈະຜູກ catalogItemId ໃຫ້;
  // ຖ້າຍັງພິມບໍ່ຄົບ/ບໍ່ກົງ ຈະຖືວ່າຍັງບໍ່ໄດ້ເລືອກ (catalogItemId ຫວ່າງ, ຊື່ໃນ "ຊື່ອຸປະກອນ" ຍັງແກ້ໄຂເອງໄດ້ຢູ່)
  const handleCatalogSearchChange = (index, value) => {
    const newItems = [...items];
    newItems[index].catalogSearch = value;

    const matched = catalog.find((c) => c.name === value);
    if (matched) {
      newItems[index].catalogItemId = matched._id;
      newItems[index].name = matched.name;
    } else {
      newItems[index].catalogItemId = '';
    }
    setItems(newItems);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    try {
      // catalogSearch ເປັນ field ໃຊ້ພາຍໃນ UI ເທົ່ານັ້ນ (ສຳລັບຄົ້ນຫາ) — ບໍ່ສົ່ງໄປໃຫ້ Backend
      const payloadItems = items.map(({ catalogItemId, name, quantity, reason }) => ({
        ...(catalogItemId ? { catalogItemId } : {}),
        name,
        quantity,
        ...(reason ? { reason } : {}),
      }));
      await axios.post('/supply-requests', { items: payloadItems });
      setIsModalOpen(false);
      setItems([{ catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }]);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create supply request');
    }
  };

  const renderStatus = (status) => {
    switch (status) {
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
            <Clock size={12} /> ລໍຖ້າອະນຸມັດ
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
            <CheckCircle size={12} /> ອະນຸມັດແລ້ວ
          </span>
        );
      case 'FULFILLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Package size={12} /> ຮັບເຄື່ອງແລ້ວ (Fulfilled)
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
            <XCircle size={12} /> ຖືກປະຕິເສດ
          </span>
        );
      default:
        return status;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຂໍອຸປະກອນສິ້ນເປືອງ (Supply Requests)</h1>
            <p className="text-sm text-gray-500 mt-1">ຍື່ນຄຳຂໍເບີກວັດສະດຸ ແລະ ຕິດຕາມສະຖານະການອະນຸມັດ</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus size={18} />
            <span>ສ້າງຄຳຂໍອຸປະກອນ</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດຄຳຂໍ (_id)</th>
                <th className="p-4 font-medium">ລາຍການອຸປະກອນ</th>
                <th className="p-4 font-medium">ຈຳນວນລວມ</th>
                <th className="p-4 font-medium">ວັນທີຍື່ນ</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td>
                </tr>
              ) : requests.length > 0 ? (
                requests.map((req) => (
                  <tr key={req._id} className="hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">{req._id}</td>
                    <td className="p-4">
                      {Array.isArray(req.items) && req.items.map((i, idx) => (
                        <div key={idx} className="text-xs">
                          • {i.name} (x{i.quantity})
                        </div>
                      ))}
                    </td>
                    <td className="p-4">
                      {Array.isArray(req.items) ? req.items.reduce((sum, i) => sum + i.quantity, 0) : 0} ຊິ້ນ
                    </td>
                    <td className="p-4 text-xs text-gray-500">
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4">{renderStatus(req.status)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    ຍັງບໍ່ມີຄຳຂໍອຸປະກອນໃນລະບົບ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">ສ້າງຄຳຂໍເບີກອຸປະກອນ</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">ລາຍການສິນຄ້າທີ່ຕ້ອງການ</label>
                    <button type="button" onClick={handleAddItem} className="text-xs text-amber-600 font-medium hover:underline">+ ເພີ່ມລາຍການອື່ນ</button>
                  </div>

                  {items.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3 relative">
                      {items.length > 1 && (
                        <button type="button" onClick={() => handleRemoveItem(index)} className="absolute top-3 right-3 text-rose-500 text-xs font-bold hover:underline">ລຶບ</button>
                      )}
                      
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ຄົ້ນຫາ ແລະ ເລືອກຈາກ Catalog (ທາງເລືອກ)</label>
                        <input
                          type="text"
                          list={`catalog-options-${index}`}
                          value={item.catalogSearch ?? ''}
                          onChange={(e) => handleCatalogSearchChange(index, e.target.value)}
                          placeholder="ພິມຄົ້ນຫາຊື່ອຸປະກອນ... ຫຼື ພິມຊື່ເອງຂ້າງລຸ່ມ"
                          className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                        />
                        <datalist id={`catalog-options-${index}`}>
                          {Array.isArray(catalog) && catalog.map(cat => (
                            <option key={cat._id} value={cat.name}>{`ຄົງເຫຼືອ: ${cat.stockQty ?? 0}`}</option>
                          ))}
                        </datalist>
                        {item.catalogItemId && (
                          <p className="text-xs text-green-600 mt-1">✓ ເລືອກແລ້ວ: {item.name} (ລະຫັດ {item.catalogItemId})</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">ຊື່ອຸປະກອນ *</label>
                          <input 
                            type="text" 
                            required
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                            placeholder="ຕົວຢ່າງ: ບີກສີຟ້າ, ເຈ້ຍ A4"
                            className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">ຈຳນວນ *</label>
                          <input 
                            type="number" 
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ເຫດຜົນການຂໍເບີກ</label>
                        <input 
                          type="text" 
                          value={item.reason}
                          onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                          placeholder="ຕົວຢ່າງ: ເຄື່ອງເກົ່າໝົດ, ໃຊ້ງານໂຄງການໃໝ່"
                          className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
                  >
                    ຍົກເລີກ
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition shadow-sm"
                  >
                    ສົ່ງຄຳຂໍ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}