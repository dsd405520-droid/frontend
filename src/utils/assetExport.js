import api from '../services/api';

const STATUS_LABEL = {
  AVAILABLE: 'ວ່າງ',
  ASSIGNED: 'ຖືກມອບໝາຍແລ້ວ',
  UNDER_REPAIR: 'ສ້ອມແປງ',
  RETIRED: 'ເລີກໃຊ້',
};

const REPAIR_STATUS = { IN_PROGRESS: 'ກຳລັງສ້ອມ', COMPLETED: 'ສ້ອມແລ້ວ', CANCELLED: 'ຍົກເລີກ' };

const EVENT_LABEL = {
  RECEIVED: 'ຮັບເຂົ້າສາງ',
  CREATED: 'ເພີ່ມເຂົ້າທະບຽນ',
  ASSIGNED: 'ມອບໝາຍ / ມີຄົນຮັບໄປ',
  ASSIGNED_DEPT: 'ມອບໃຫ້ພະແນກ',
  RETURNED: 'ຮັບຄືນເຂົ້າສາງ',
  REPAIR: 'ສ້ອມແປງ',
  STATUS_CHANGED: 'ປ່ຽນສະຖານະ',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '');
const money = (n) => (n != null ? Number(n).toLocaleString() : '');
const person = (p) => (p ? `${p.name}${p.code ? ` (${p.code})` : ''}` : '');

const eventDetails = (e) => {
  const d = e.detail || {};
  let rows = [];
  switch (e.type) {
    case 'RECEIVED':
      rows = [
        ['ໃບຮັບເຄື່ອງ', d.receiptNo],
        ['ຜູ້ຂາຍ', d.vendor],
        ['ເລກບິນ', d.invoiceNo],
        ['ລາຄາ', money(d.unitPrice)],
        ['ໃບສະເໜີຊື້', d.purchaseRequestNo],
        ['ຫ້ອງເກັບ', d.storageRoom],
        ['ຮັບໂດຍ', person(e.actor)],
      ];
      break;
    case 'CREATED':
      rows = [
        ['ວັນທີຊື້', fmtDate(d.purchaseDate)],
        ['ລາຄາ', money(d.purchasePrice)],
        ['ເພີ່ມໂດຍ', person(e.actor)],
      ];
      break;
    case 'ASSIGNED':
    case 'ASSIGNED_DEPT':
      rows = [
        ['ພະແນກ', e.department],
        [e.department ? 'ຜູ້ຮັບຜິດຊອບ' : 'ຜູ້ຮັບ', person(e.holder)],
        ['ຮັບແທນໂດຍ', person(e.receivedBy)],
        ['ຜູ້ດຳເນີນການ', person(e.actor)],
      ];
      break;
    case 'RETURNED':
      rows = [
        ['ຄືນຈາກ', person(e.holder)],
        ['ພະແນກ', e.department],
        ['ຜູ້ດຳເນີນການ', person(e.actor)],
      ];
      break;
    case 'REPAIR':
      rows = [
        ['ສະຖານະ', REPAIR_STATUS[d.status] || d.status],
        ['ບັນຫາ', d.issue],
        ['ລາຍລະອຽດ', d.description],
        ['ໝາຍເຫດສ້ອມ', d.repairNotes],
        ['ຊ່າງ', d.technician],
        ['ຄ່າໃຊ້ຈ່າຍ', money(d.cost)],
        ['ສ້ອມແລ້ວວັນທີ', fmtDate(d.completionDate)],
        ['ບັນທຶກໂດຍ', person(e.actor)],
      ];
      break;
    default:
      rows = [
        ['ຈາກ → ເປັນ', `${STATUS_LABEL[d.from] || d.from || '—'} → ${STATUS_LABEL[d.to] || d.to || '—'}`],
        ['ໂດຍ', person(e.actor)],
      ];
  }
  return rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
};

export async function buildAssetExport({ assetId, title, status, subtitle, fields, history }) {
  const res = await api.get(`/assets/${encodeURIComponent(assetId)}/timeline`);
  const body = res.data;
  const timeline = (body && body.data !== undefined ? body.data : body) || {};
  const holder = person(timeline.currentHolder);
  const summary = [
    ['ເຂົ້າສາງຄັ້ງທຳອິດ', fmtDate(timeline.firstReceivedAt) || '—'],
    ['ສະຖານະ', STATUS_LABEL[timeline.status] || timeline.status || '—'],
    [
      'ໃຜຖືຢູ່ຕອນນີ້',
      `${holder || '— (ຢູ່ສາງ)'}${timeline.currentDepartment ? ` · ພະແນກ ${timeline.currentDepartment}` : ''}`,
    ],
  ];
  const events = (timeline.events || []).map((e) => ({
    at: fmtDateTime(e.at),
    label: EVENT_LABEL[e.type] || EVENT_LABEL.STATUS_CHANGED,
    details: eventDetails(e).map(([k, v]) => `${k}: ${v}`).join(' | '),
    note: e.note || '',
  }));
  return { title, status, subtitle, fields, summary, events, history, exportedAt: new Date().toLocaleString() };
}

const csvValue = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export function buildAssetCsv(data) {
  const lines = [];
  const push = (row) => lines.push(row.map(csvValue).join(','));

  push(['ຂໍ້ມູນຊັບສິນ', data.title]);
  push(['ຫົວຂໍ້', 'ຄ່າ']);
  data.fields.forEach(([k, v]) => push([k, v]));
  data.summary.forEach(([k, v]) => push([k, v]));
  push(['ສົ່ງອອກເມື່ອ', data.exportedAt]);

  lines.push('');
  push([`ໄທມ໌ໄລນ໌ (${data.events.length})`]);
  push(['ວັນທີ-ເວລາ', 'ເຫດການ', 'ລາຍລະອຽດ', 'ໝາຍເຫດ']);
  data.events.forEach((e) => push([e.at, e.label, e.details, e.note]));

  lines.push('');
  push([`ປະຫວັດການມອບໝາຍ (${data.history.length})`]);
  push(['ຜູ້ຮັບ', 'ພະແນກ', 'ຮັບແທນໂດຍ', 'ມອບເມື່ອ', 'ຄືນເມື່ອ', 'ໝາຍເຫດ']);
  data.history.forEach((h) => push([h.assignee, h.department, h.receivedBy, h.assignedAt, h.returnedAt, h.note]));

  return '\uFEFF' + lines.join('\r\n');
}

export function downloadAssetCsv(data) {
  const blob = new Blob([buildAssetCsv(data)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.title || 'asset'}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const buildAssetHtml = (data) => {
  const fieldCells = data.fields
    .map(([k, v]) => `<div class="cell"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`)
    .join('');
  const summaryCells = data.summary
    .map(([k, v]) => `<div class="cell box"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`)
    .join('');
  const eventRows = data.events.length
    ? data.events
        .map(
          (e) => `<tr><td class="nw">${esc(e.at)}</td><td class="b">${esc(e.label)}</td><td>${esc(e.details)}${
            e.note ? `<div class="note">"${esc(e.note)}"</div>` : ''
          }</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="empty">ຍັງບໍ່ມີປະຫວັດ</td></tr>';
  const historyRows = data.history.length
    ? data.history
        .map(
          (h) =>
            `<tr><td>${esc(h.assignee)}${h.department ? `<div class="note">ພະແນກ ${esc(h.department)}</div>` : ''}</td><td>${esc(
              h.receivedBy,
            )}</td><td class="nw">${esc(h.assignedAt)}</td><td class="nw">${esc(h.returnedAt)}</td><td>${esc(h.note)}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="5" class="empty">ຍັງບໍ່ເຄີຍຖືກມອບໝາຍ</td></tr>';

  return `<!DOCTYPE html>
<html lang="lo"><head><meta charset="utf-8"><title>${esc(data.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;600;700&display=swap">
<style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: 'Noto Sans Lao', 'Noto Sans Lao Looped', 'Phetsarath OT', 'Saysettha OT', 'Leelawadee UI', Tahoma, sans-serif; font-size: 11px; color: #1f2937; margin: 0; }
h1 { font-size: 20px; margin: 0; }
h2 { font-size: 13px; margin: 18px 0 6px; color: #374151; }
.head { display: flex; align-items: center; gap: 10px; }
.badge { font-size: 10px; padding: 2px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-weight: 600; }
.sub { color: #6b7280; margin-top: 3px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 8px; padding: 12px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.cell .k { color: #9ca3af; font-size: 9.5px; }
.cell .v { font-weight: 600; word-break: break-word; }
.box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; background: #f3f4f6; font-size: 10px; color: #6b7280; }
th, td { border: 1px solid #e5e7eb; padding: 5px 7px; vertical-align: top; }
tr { page-break-inside: avoid; }
.nw { white-space: nowrap; }
.b { font-weight: 600; }
.note { color: #6b7280; font-style: italic; margin-top: 2px; }
.empty { text-align: center; color: #9ca3af; }
.foot { margin-top: 16px; color: #9ca3af; font-size: 9.5px; text-align: right; }
</style></head><body>
<div class="head"><h1>${esc(data.title)}</h1><span class="badge">${esc(data.status)}</span></div>
<div class="sub">${esc(data.subtitle)}</div>
<h2>ຂໍ້ມູນຊັບສິນ</h2>
<div class="grid">${fieldCells}</div>
<h2>ສະຫຼຸບ</h2>
<div class="grid3">${summaryCells}</div>
<h2>ໄທມ໌ໄລນ໌ — ເຂົ້າສາງ / ໃຜຮັບ / ໃຜຖື (${data.events.length})</h2>
<table><thead><tr><th>ວັນທີ-ເວລາ</th><th>ເຫດການ</th><th>ລາຍລະອຽດ</th></tr></thead><tbody>${eventRows}</tbody></table>
<h2>ປະຫວັດການມອບໝາຍ (${data.history.length})</h2>
<table><thead><tr><th>ຜູ້ຮັບ</th><th>ຮັບແທນໂດຍ</th><th>ມອບເມື່ອ</th><th>ຄືນເມື່ອ</th><th>ໝາຍເຫດ</th></tr></thead><tbody>${historyRows}</tbody></table>
<div class="foot">ສົ່ງອອກເມື່ອ ${esc(data.exportedAt)}</div>
</body></html>`;
};

export function printAssetPdf(data) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write(buildAssetHtml(data));
  doc.close();

  const link = doc.querySelector('link[rel="stylesheet"]');
  const stylesheetReady = new Promise((resolve) => {
    if (!link) return resolve();
    link.onload = resolve;
    link.onerror = resolve;
    setTimeout(resolve, 3000);
  });

  stylesheetReady
    .then(() =>
      doc.fonts
        ? Promise.all([doc.fonts.load('400 12px "Noto Sans Lao"'), doc.fonts.load('700 12px "Noto Sans Lao"')]).catch(() => null)
        : null,
    )
    .then(() => {
      setTimeout(() => {
        win.focus();
        win.print();
      }, 200);
    });

  win.onafterprint = () => setTimeout(() => iframe.remove(), 500);
  setTimeout(() => iframe.remove(), 120000);
}
