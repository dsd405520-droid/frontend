import { useState, useRef } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';


export default function CsvImportButton({
  endpoint,
  refresh,
  permitted = true,
  label = 'Import CSV',
  csvHint,
  buttonClassName = '',
}) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!permitted) return null;

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError('');
    setImportResult(null);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      let body = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }

      if (!res.ok) {
        throw new Error(body?.message || body?.msg || `ການນຳເຂົ້າ CSV ລົ້ມເຫຼວ (HTTP ${res.status})`);
      }

      const result = body?.data ?? body;
      setImportResult(result);
      if (typeof refresh === 'function') refresh();
    } catch (err) {
      setError(err.message || 'ການນຳເຂົ້າ CSV ລົ້ມເຫຼວ');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const failedRows = (importResult?.results || []).filter((r) => !r.success);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFile}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className={`border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${buttonClassName}`}
      >
        {importing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
        <span>{importing ? 'ກຳລັງນຳເຂົ້າ...' : label}</span>
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {importResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-100 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Upload className="text-amber-500" size={20} />
                ຜົນການນຳເຂົ້າ CSV
              </h3>
              <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500">ທັງໝົດ (Total)</p>
                  <p className="text-2xl font-bold text-gray-800">{importResult.total ?? 0}</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                  <p className="text-xs text-green-600">ນຳເຂົ້າສຳເລັດ (Created)</p>
                  <p className="text-2xl font-bold text-green-700">{importResult.created ?? 0}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                  <p className="text-xs text-red-600">ລົ້ມເຫຼວ (Failed)</p>
                  <p className="text-2xl font-bold text-red-600">{importResult.failed ?? 0}</p>
                </div>
              </div>

              {csvHint && <p className="text-xs text-gray-400">{csvHint}</p>}

              {failedRows.length > 0 && (
                <div className="border border-red-100 rounded-xl overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 text-sm font-medium text-red-600">
                    ລາຍລະອຽດຂໍ້ຜິດພາດ
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400">
                          <th className="p-3 font-medium">ແຖວ (Row)</th>
                          <th className="p-3 font-medium">ລາຍການ (Reference)</th>
                          <th className="p-3 font-medium">ຂໍ້ຜິດພາດ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-600">
                        {failedRows.map((r, idx) => (
                          <tr key={idx}>
                            <td className="p-3">{r.row}</td>
                            <td className="p-3">{r.reference || r.email || '-'}</td>
                            <td className="p-3 text-red-500">{r.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setImportResult(null)}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition shadow-sm"
                >
                  ປິດ (Close)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}