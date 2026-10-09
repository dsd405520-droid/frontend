import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Plus, CheckCircle, Clock, XCircle, PackageCheck, ScanLine, Camera } from 'lucide-react';
import { hasPermission, getCurrentUser } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import CameraScanner from '../components/CameraScanner';
import axios from '../services/api';

export default function InventorySupplies() {
  const [searchParams] = useSearchParams();
  const canRequest = hasPermission('supplies', 'create');

  const [requests, setRequests] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [items, setItems] = useState([{ catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }]);

  // ຮັບເຄື່ອງທີ່ຄັງ — ຫຼັງອະນຸມັດແລ້ວ ພະນັກງານສະແກນ QR/ບາໂຄ໊ດ ຂອງອຸປະກອນ 2 ຂັ້ນ:
  //   1. ສະແກນເຄື່ອງ → ກວດກັບລາຍການທີ່ຂໍ (ຖ້າມີສິດອ່ານທະບຽນຊັບສິນ)
  //   2. ຢືນຢັນຜູ້ຮັບ (ລະຫັດພະນັກງານ) → ບັນທຶກ ເຄື່ອງຈະຂຶ້ນກັບທະບຽນຊັບສິນຂອງບໍລິສັດ
  const [receiveRequest, setReceiveRequest] = useState(null);
  const [scanTags, setScanTags] = useState('');
  const [receiveStage, setReceiveStage] = useState(1); // 1 = ສະແກນເຄື່ອງ, 2 = ຢືນຢັນຜູ້ຮັບ
  const [allAssets, setAllAssets] = useState(null);    // null = ບໍ່ມີສິດ assets:read → ໃຫ້ Backend ກວດຕອນບັນທຶກ
  const [assigneeCode, setAssigneeCode] = useState('');
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const [receiveResult, setReceiveResult] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // Navbar "ສ້າງໃໝ່" → ເປີດ Modal ຂໍອຸປະກອນສິ້ນເປືອງ ອັດຕະໂນມັດ
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('create')]);

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

  const openReceive = async (req) => {
    setReceiveRequest(req);
    setScanTags('');
    setReceiveStage(1);
    setAllAssets(null);
    setAssigneeCode(
      req.requestedBy?.employeeCode || req.userId?.employeeCode || req.createdBy?.employeeCode || getCurrentUser()?.employeeCode || ''
    );
    setReceiveError('');
    setReceiveResult(null);
    setScannerOpen(false);
    // ຄົ້ນຫາທະບຽນຊັບສິນກ່ອນ (ເພື່ອກວດວ່າ tag ມີຈິງ/ຊະນິດກົງ/ສະຖານະວ່າງ) — ຖ້າບໍ່ມີສິດ ໃຫ້ Backend ກວດຕອນບັນທຶກ
    if (hasPermission('assets', 'read')) {
      try {
        const res = await axios.get('/assets');
        const data = res.data;
        setAllAssets(Array.isArray(data) ? data : (data.data || data.items || []));
      } catch {
        setAllAssets(null);
      }
    }
  };

  const closeReceive = () => {
    setReceiveRequest(null);
    setReceiveResult(null);
    setReceiveError('');
    setReceiveStage(1);
    setScannerOpen(false);
    fetchData();
  };

  const scannedTags = () => scanTags.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  // ເພີ່ມ tag ທີ່ສະແກນຈາກກ້ອງ (ກັນຊ້ຳ, ແຍກບັນທັດລະແຖວ)
  const appendScannedTag = (text) => {
    const tag = String(text || '').trim();
    if (!tag) return;
    setScanTags((prev) => {
      const existing = prev.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (existing.some((t) => t.toLowerCase() === tag.toLowerCase())) return prev;
      const trimmed = prev.replace(/\s+$/, '');
      return trimmed ? `${trimmed}\n${tag}` : tag;
    });
    setReceiveError('');
  };

  // ກວດ tag ທີ່ສະແກນກັບທະບຽນຊັບສິນ + ລາຍການທີ່ຂໍ (ສະແດງຜົນກ່ອນຢືນຢັນ)
  const scanResults = receiveRequest
    ? scannedTags().map((tag) => {
        if (!Array.isArray(allAssets)) return { tag };
        const a = allAssets.find((x) => (x.assetTag || '').toLowerCase() === tag.toLowerCase());
        if (!a) return { tag, status: 'not-found' };
        const reqNames = (receiveRequest.items || []).map((i) => (i.name || '').toLowerCase()).filter(Boolean);
        const typeOk =
          reqNames.length === 0 ||
          reqNames.some((n) => n.includes((a.type || '').toLowerCase()) || (a.type || '').toLowerCase().includes(n));
        const status = a.status === 'AVAILABLE' && typeOk ? 'ok' : (a.status !== 'AVAILABLE' ? 'not-available' : 'type-mismatch');
        return { tag, status, asset: a };
      })
    : [];

  const gotoStage2 = () => {
    const tags = scannedTags();
    if (tags.length === 0) {
      setReceiveError('ກະລຸນາສະແກນ ຫຼື ກຣອກລະຫັດ Asset Tag ຢ່າງໜ້ອຍ 1 ລາຍການ');
      return;
    }
    // ຖ້າສາມາດກວດໃນໜ້າໄດ້ ຕ້ອງຜ່ານທຸກລາຍການກ່ອນ (ບໍ່ພົບ/ບໍ່ວ່າງ/ຊະນິດບໍ່ກົງ) ຈຶ່ງດຳເນີນຕໍ່ໄດ້
    if (Array.isArray(allAssets) && scanResults.some((r) => r.status && r.status !== 'ok')) {
      setReceiveError('ມີລາຍການທີ່ບໍ່ຜ່ານການກວດ (ເບິ່ງສີແດງ) — ໃຫ້ແກ້/ລຶບແຖວນັ້ນກ່ອນ ຈຶ່ງດຳເນີນການຕໍ່ (ເພື່ອບໍ່ມອບເຄື່ອງຜິດ)');
      return;
    }
    setReceiveError('');
    setReceiveStage(2);
  };

  // ບັນທຶກ: Backend ກວດ ໃບຂໍຕ້ອງເປັນ APPROVED, asset ມີຢູ່ + AVAILABLE + ຊະນິດກົງກັບລາຍການ,
  // ຢືນຢັນລະຫັດຜູ້ຮັບ ແລ້ວຜູກ asset ກັບຜູ້ຮັບ + ອັບທະບຽນຊັບສິນ ແລະ ຕັ້ງໃບຂໍເປັນ FULFILLED
  const submitReceive = async (e) => {
    e.preventDefault();
    const assetTags = scannedTags();
    if (assetTags.length === 0) {
      setReceiveError('ກະລຸນາສະແກນ ຫຼື ກຣອກລະຫັດ Asset Tag ຢ່າງໜ້ອຍ 1 ລາຍການ');
      return;
    }
    setReceiving(true);
    setReceiveError('');
    try {
      await axios.patch(`/supply-requests/${receiveRequest._id}/receive`, {
        assetTags,
        ...(assigneeCode.trim() ? { assigneeCode: assigneeCode.trim() } : {}),
      });
      setReceiveResult({ ok: true, assetTags, assigneeCode });
      fetchData();
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 405) {
        setReceiveError('Backend ຍັງບໍ່ມີ Endpoint ນີ້: PATCH /supply-requests/:id/receive — ລໍຖ້າຝ່າຍ Backend ເພີ່ມໃຫ້ກ່ອນ');
      } else {
        setReceiveError(err.response?.data?.message || err.response?.data?.msg || 'ການບັນທຶກບໍ່ສຳເລັດ — ກະລຸນາກວດສອບລະຫັດທີ່ສະແກນ ຫຼື ລະຫັດພະນັກງານຜູ້ຮັບ');
      }
    } finally {
      setReceiving(false);
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
          {canRequest && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span>ສ້າງຄຳຂໍອຸປະກອນ</span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
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
                    <td className="p-4">
                      {renderStatus(req.status)}
                      {req.status === 'APPROVED' && hasPermission('supplies', 'fulfill') && (
                        <button
                          onClick={() => openReceive(req)}
                          title="ສະແກນເຄື່ອງ — ຮັບເຄື່ອງທີ່ຄັງ ແລະ ຜູກເຂົ້າທະບຽນຊັບສິນ"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition"
                        >
                          <ScanLine size={13} /> ສະແກນເຄື່ອງ
                        </button>
                      )}
                    </td>
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

        {receiveRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">
                  {receiveStage === 1 ? 'ສະແກນເຄື່ອງ' : 'ຢືນຢັນຜູ້ຮັບ'} — {receiveRequest._id}
                </h2>
                <button type="button" onClick={closeReceive} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {receiveStage === 1 ? (
                <form onSubmit={(e) => { e.preventDefault(); gotoStage2(); }} className="space-y-3">
                  <p className="text-xs text-gray-500">
                    ສະແກນ ຫຼື ກຣອກລະຫັດ Asset Tag ຈາກບາໂຄ໊ດ/QR ທີ່ຕິດກັບເຄື່ອງຂອງບໍລິສັດ.
                    ລະບົບຈະກວດກັບທະບຽນຊັບສິນ ແລະ ລາຍການທີ່ຂໍ ກ່ອນຈະຢືນຢັນ.
                  </p>

                  <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
                    <div className="font-semibold text-gray-700">ລາຍການທີ່ຂໍ:</div>
                    {Array.isArray(receiveRequest.items) && receiveRequest.items.map((it, idx) => (
                      <div key={idx} className="text-xs flex justify-between">
                        <span>{it.name}</span>
                        <span className="text-gray-500">x{it.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-600">Asset Tag (ສະແກນ/ພິມ)</label>
                      <button
                        type="button"
                        onClick={() => setScannerOpen(true)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium transition"
                      >
                        <Camera size={13} /> ສະແກນດ້ວຍກ້ອງ
                      </button>
                    </div>
                    <textarea
                      autoFocus
                      required
                      rows={4}
                      value={scanTags}
                      onChange={(e) => { setScanTags(e.target.value); setReceiveError(''); }}
                      placeholder="ສະແກນ ຫຼື ກຣອກ ລະຫັດ Asset Tag — 1 ລາຍການຕໍ່ແຖວ..."
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">ສະແກນຫຼາຍອັນຕິດຕໍ່ກັນໄດ້ — ແຕ່ລະອັນຂຶ້ນບັນທັດໃໝ່ (Enter ພາຍຫຼັງສະແກນ)</p>
                  </div>

                  {scanResults.length > 0 && (
                    <div className="space-y-1.5">
                      {scanResults.map((r, i) => {
                        const { cls, text } =
                          !r.status
                            ? { text: 'ລໍຖ້າ Backend ກວດສອບຕອນບັນທຶກ', cls: 'text-gray-500' }
                            : r.status === 'ok'
                              ? { text: `✓ ${r.asset.type} — ກົງກັບລາຍການ ແລະ ວ່າງ`, cls: 'text-emerald-600' }
                              : r.status === 'not-found'
                                ? { text: '✕ ບໍ່ພົບລະຫັດນີ້ໃນທະບຽນຊັບສິນ', cls: 'text-red-600' }
                                : r.status === 'not-available'
                                  ? { text: `✕ ສະຖານະ ${r.asset.status} — ບໍ່ວ່າງ`, cls: 'text-red-600' }
                                  : { text: `✕ ຊະນິດບໍ່ກົງກັບລາຍການທີ່ຂໍ (${r.asset.type})`, cls: 'text-red-600' };
                        return (
                          <div key={i} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex justify-between gap-2">
                            <span className="font-mono truncate">{r.tag}</span>
                            <span className={cls}>{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {receiveError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{receiveError}</div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={closeReceive} className="px-4 py-2 text-sm text-gray-600">ປິດ</button>
                    <button
                      type="submit"
                      disabled={scannedTags().length === 0}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <PackageCheck size={15} /> ຖັດໄປ: ຢືນຢັນຜູ້ຮັບ
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={submitReceive} className="space-y-3">
                  <p className="text-xs text-gray-500">
                    ກວດສອບຜູ້ທີ່ຈະຮັບເຄື່ອງ. Backend ຈະຢືນຢັນລະຫັດອີກຄັ້ງ ກ່ອນຜູກເຄື່ອງເຂົ້າທະບຽນຊັບສິນຂອງບໍລິສັດ.
                  </p>

                  <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                    <div className="font-semibold text-gray-700">ເຄື່ອງທີ່ຈະຮັບ ({scannedTags().length})</div>
                    <div className="text-xs text-gray-600 break-all font-mono">{scannedTags().join(', ')}</div>
                    <div className="pt-1">
                      <label className="block text-xs text-gray-500 mb-1">ລະຫັດພະນັກງານຜູ້ຮັບ *</label>
                      <input
                        required
                        value={assigneeCode}
                        onChange={(e) => setAssigneeCode(e.target.value)}
                        placeholder="ລະຫັດພະນັກງານ..."
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm tracking-widest"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        ຄ່າເລີ່ມຕົ້ນ = ຜູ້ຂໍຂອງຄຳຂໍນີ້ — ແກ້ໄດ້ຖ້າໃຫ້ຄົນອື່ນຮັບ (ຖ້າບໍ່ມີສິດ assets:assign Backend ຈະປະຕິເສດ)
                      </p>
                    </div>
                  </div>

                  {receiveError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{receiveError}</div>
                  )}
                  {receiveResult?.ok && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      ✓ ບັນທຶກສຳເລັດ — ຜູກ {receiveResult.assetTags.length} ຊິ້ນ ກັບຜູ້ຮັບ {receiveResult.assigneeCode} ແລະ ຂຶ້ນທະບຽນຊັບສິນແລ້ວ
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setReceiveStage(1)} className="px-4 py-2 text-sm text-gray-600">ກັບຄືນ</button>
                    <button type="button" onClick={closeReceive} className="px-4 py-2 text-sm text-gray-600">ປິດ</button>
                    <button
                      type="submit"
                      disabled={receiving || !!receiveResult?.ok}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <PackageCheck size={15} />
                      {receiving ? 'ກຳລັງບັນທຶກ...' : 'ຢືນຢັນ ແລະ ບັນທຶກ'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {scannerOpen && (
          <CameraScanner
            continuous
            title="ສະແກນ Asset Tag"
            hint="ຈ່ອງກ້ອງໃສ່ QR/ບາໂຄ໊ດ — ສະແກນໄດ້ຫຼາຍອັນຕິດຕໍ່ກັນ"
            onScan={appendScannedTag}
            onClose={() => setScannerOpen(false)}
          />
        )}
      </div>
    </MainLayout>
  );
}