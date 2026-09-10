import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ບັນທຶກການກວດສອບ (Audit Logs)</h1>
          <p className="text-sm text-gray-500 mt-1">ຕິດຕາມກວດສອບການກະທຳທີ່ມີຄວາມລະອຽດອ່ອນໃນລະບົບ</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດ (_id)</th>
                <th className="p-4 font-medium">ຜູ້ກະທຳ</th>
                <th className="p-4 font-medium">ການກະທຳ (Action)</th>
                <th className="p-4 font-medium">ລາຍລະອຽດ</th>
                <th className="p-4 font-medium">ເວລາ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {logs.length > 0 ? (
                logs.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">{item._id}</td>
                    <td className="p-4">{item.user}</td>
                    <td className="p-4">{item.action}</td>
                    <td className="p-4">{item.details}</td>
                    <td className="p-4 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    ຍັງບໍ່ມີບັນທຶກ Audit Log (ພ້ອມເຊື່ອມຕໍ່ NestJS Backend)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}