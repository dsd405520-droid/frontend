import { useState } from 'react';
import { Download } from 'lucide-react';

const csvValue = (value) => {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

export default function CsvExportButton({
  data = [],
  filename = 'export.csv',
  columns = [],
  label = 'Export CSV',
  permitted = true,
  buttonClassName = '',
}) {
  const [exporting, setExporting] = useState(false);

  if (!permitted) return null;

  const handleExport = () => {
    if (!Array.isArray(data) || data.length === 0) {
      alert('ບໍ່ມີຂໍ້ມູນໃຫ້ export');
      return;
    }
    setExporting(true);
    try {
      const header = columns.map((c) => csvValue(c.label));
      const rows = data.map((row) =>
        columns.map((c) => csvValue(typeof c.value === 'function' ? c.value(row) : row?.[c.key]))
      );
      const csvContent = '\uFEFF' + [header, ...rows].map((r) => r.join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className={`border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 disabled:opacity-50 ${buttonClassName}`}
    >
      <Download size={16} />
      <span>{exporting ? 'ກຳລັງ export...' : label}</span>
    </button>
  );
}