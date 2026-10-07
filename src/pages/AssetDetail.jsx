import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Barcode, Wrench, History, User, Building2, Calendar } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { hasPermission } from '../utils/permissions';
import BarcodeComponent from 'react-barcode';
import { API_BASE_URL } from '../config';


function statusInfo(status) {
  switch (status) {
    case 'ASSIGNED':
      return { label: 'ຖືກມອບໝາຍແລ້ວ', className: 'bg-blue-100 text-blue-700' };
    case 'UNDER_REPAIR':
      return { label: 'ກຳລັງສ້ອມແປງ', className: 'bg-amber-100 text-amber-700' };
    case 'RETIRED':
      return { label: 'ປົດລະວາງແລ້ວ', className: 'bg-gray-200 text-gray-600' };
    default:
      return { label: 'ວ່າງ', className: 'bg-green-100 text-green-700' };
  }
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const canView = hasPermission('assets', 'read');
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);

  function unwrap(body) {
    return body?.data !== undefined ? body.data : body;
  }

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError('');
        const assetRes = await fetch(`${API_BASE_URL}/assets/${id}`, { headers });
        const assetBody = await assetRes.json();
        if (!assetRes.ok) throw new Error(assetBody?.msg || 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຊັບສິນໄດ້');
        setAsset(unwrap(assetBody));

        const [branchesRes, usersRes, deptsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/branches`, { headers }),
          fetch(`${API_BASE_URL}/users`, { headers }),
          fetch(`${API_BASE_URL}/departments`, { headers }),
        ]);
        if (branchesRes.ok) {
          const b = await branchesRes.json();
          setBranches(unwrap(b) || []);
        }
        if (usersRes.ok) {
          const u = await usersRes.json();
          setUsers(unwrap(u) || []);
        }
        if (deptsRes.ok) {
          const d = await deptsRes.json();
          setDepartments(unwrap(d) || []);
        }

        // fetch maintenance
        try {
          setLoadingMaintenance(true);
          const mRes = await fetch(`${API_BASE_URL}/maintenance-history/asset/${id}`, { headers });
          if (mRes.ok) {
            const mBody = await mRes.json();
            setMaintenance(unwrap(mBody) || []);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingMaintenance(false);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (id && canView) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!canView) {
    return (
      <MainLayout>
        <div className="text-center text-red-600 py-10">ບໍ່ມີສິດເບິ່ງຂໍ້ມູນຊັບສິນ</div>
      </MainLayout>
    );
  }

  const branchName = (bid) => branches.find((b) => b._id === bid)?.name || bid;
  const user = (uid) => users.find((u) => u._id === uid);
  const userName = (uid) => {
    const u = user(uid);
    return u ? `${u.firstName} ${u.lastName}${u.employeeCode ? ` (${u.employeeCode})` : ''}` : uid;
  };
  const assigneeDept = (uid) => {
    const u = user(uid);
    const deptRef = u?.departmentId;
    if (!deptRef) return null;
    // backend ອາດສົ່ງ departmentId ແບບ object (populated) ຫຼື string id
    if (typeof deptRef === 'object') return deptRef.name || deptRef._id || null;
    const d = departments.find((dep) => dep._id === deptRef);
    return d?.name || deptRef;
  };
  const info = asset ? statusInfo(asset.status) : null;
  const qrUrl = asset ? `${window.location.origin}/assets/${asset._id}` : '';

  return (
    <MainLayout>
      <div className="space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
          <ArrowLeft size={16} /> ກັບຄືນ
        </button>

        {loading ? (
          <div className="text-center text-gray-400 py-10">ກຳລັງໂຫຼດ...</div>
        ) : error ? (
          <div className="text-center text-red-600 py-10">{error}</div>
        ) : !asset ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center space-y-3">
            <Barcode size={32} className="mx-auto text-gray-300" />
            <p className="text-gray-500">ບໍ່ພົບຊັບສິນນີ້ (ອາດຖືກລຶບ ຫຼື ID ບໍ່ຖືກຕ້ອງ)</p>
            <button
              onClick={() => navigate('/asset-registry')}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium"
            >
              ກັບໄປໜ້າທະບຽນຊັບສິນ
            </button>
          </div>
        ) : asset ? (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">{asset.assetTag}</h1>
                    <p className="text-gray-500 mt-1">{asset.type}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 size={16} />
                      <span>ສາຂາ: {branchName(asset.branchId)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${info.className}`}>{info.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User size={16} />
                      <span>ຜູ້ຖືກມອບໝາຍ: {asset.currentAssigneeId ? userName(asset.currentAssigneeId) : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 size={16} />
                      <span>ພະແນກ (ຂອງຜູ້ຖືກມອບໝາຍ): {asset.currentAssigneeId ? (assigneeDept(asset.currentAssigneeId) || '—') : '—'}</span>
                    </div>
                    {asset.purchaseDate && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar size={16} />
                        <span>ວັນທີຊື້: {new Date(asset.purchaseDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {asset.warrantyExpiry && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar size={16} />
                        <span>ໝົດປະກັນ: {new Date(asset.warrantyExpiry).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-3 p-4 border border-gray-100 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Barcode size={16} /> Barcode
                  </div>
                  {qrUrl && <BarcodeComponent value={qrUrl} width={2} height={60} fontSize={12} displayValue={true} />}
                  <div className="text-xs text-gray-500 break-all max-w-[200px] text-center">{qrUrl}</div>
                  <div className="text-xs text-gray-400">Scan ເພື່ອເຂົ້າໜ້າລາຍລະອຽດຊັບສິນ</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench size={18} className="text-amber-500" />
                  <h2 className="font-bold text-gray-800">ປະຫວັດການສ້ອມແປງ / ບໍາລຸງຮັກສາ</h2>
                </div>
                <span className="text-xs text-gray-500">{loadingMaintenance ? 'ກຳລັງໂຫຼດ...' : `${maintenance.length} ລາຍການ`}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {maintenance.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">ບໍ່ມີຂໍ້ມູນປະຫວັດການສ້ອມແປງ</div>
                ) : (
                  maintenance.map((m) => (
                    <div key={m._id} className="p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : m.status === 'CANCELLED' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>
                            {m.status}
                          </span>
                          {m.maintenanceDate && <span className="text-xs text-gray-500">ວັນທີເລີ່ມ: {new Date(m.maintenanceDate).toLocaleString()}</span>}
                          {m.completionDate && <span className="text-xs text-gray-500">ສຳເລັດ: {new Date(m.completionDate).toLocaleString()}</span>}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-3">
                          {m.technicianId?.firstName && <span><History size={12} className="inline mr-1" />{m.technicianId.firstName} {m.technicianId.lastName}</span>}
                          {m.recordedBy?.firstName && <span>ບັນທຶກໂດຍ: {m.recordedBy.firstName} {m.recordedBy.lastName}</span>}
                        </div>
                      </div>
                      {m.issue && <div className="text-sm text-gray-800 font-medium">ບັນຫາ: {m.issue}</div>}
                      {m.description && <div className="text-sm text-gray-600">ລາຍລະອຽດ: {m.description}</div>}
                      {m.repairNotes && <div className="text-sm text-gray-600">ບັນທຶກການສ້ອມແປງ: {m.repairNotes}</div>}
                      {(m.previousStatus || m.newStatus || m.cost !== undefined) && (
                        <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                          {m.previousStatus && <span>ສະຖານະເກົ່າ: {m.previousStatus}</span>}
                          {m.newStatus && <span>→ {m.newStatus}</span>}
                          {m.cost !== undefined && <span>ຄ່າໃຊ້ຈ່າຍ: {m.cost}</span>}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}
