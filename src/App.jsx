import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import ໂມດູນ Login ແລະ ປ້ອງກັນ Route
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

// Import ໂມດູນຕ່າງໆຈາກໂຟນເດີ pages
import Dashboard from './pages/Dashboard';
import Issues from './pages/Issues';
import Slamanagement from './pages/Slamanagement';
import RolesManagement from './pages/RolesManagement';
import BranchesManagement from './pages/BranchesManagement';
import Announcements from './pages/Announcements';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import AssetManagement from './pages/AssetManagement';
import UsersManagement from './pages/UsersManagement';
import MeetingRooms from './pages/MeetingRooms';
import RoomStatusReport from './pages/RoomStatusReport';
import AssetRegistry from './pages/AssetRegistry';
import InventorySupplies from './pages/InventorySupplies';
import KnowledgeBase from './pages/KnowledgeBase';
import TicketTypesManagement from './pages/TicketTypesManagement';
import TicketChat from './pages/TicketChat';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* ໜ້າ Login ບໍ່ຕ້ອງປ້ອງກັນ */}
        <Route path="/login" element={<Login />} />

        {/* Dashboard: ຕ້ອງ login ຢ່າງດຽວ, ບໍ່ຮຽກຮ້ອງ permission ສະເພາະໂມດູນ */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

        {/* ການບໍລິການ / Tickets */}
        <Route path="/issues" element={<ProtectedRoute module="tickets"><Issues /></ProtectedRoute>} />
        <Route path="/issues/:id/chat" element={<ProtectedRoute module="tickets"><TicketChat /></ProtectedRoute>} />
        <Route path="/sla-management" element={<ProtectedRoute module="sla"><Slamanagement /></ProtectedRoute>} />
        <Route path="/ticket-types" element={<ProtectedRoute module="ticket-types"><TicketTypesManagement /></ProtectedRoute>} />
        <Route path="/knowledge-base" element={<ProtectedRoute module="kb"><KnowledgeBase /></ProtectedRoute>} />

        {/* ອົງກອນ / Admin-level */}
        <Route path="/users" element={<ProtectedRoute module="users"><UsersManagement /></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute module="roles"><RolesManagement /></ProtectedRoute>} />
        <Route path="/branches" element={<ProtectedRoute module={["branches", "departments"]}><BranchesManagement /></ProtectedRoute>} />
        {/* ໝາຍເຫດ: AssetManagement.jsx (route /assets) ໃນຄວາມເປັນຈິງເອີ້ນແຕ່ /supply-catalog ແລະ
            /supply-requests — ບໍ່ໄດ້ແຕະ backend module 'assets' ເລີຍ (ໂມດູນ assets ແທ້ໆ ສຳລັບ
            ມອບໝາຍອຸປະກອນ/serial number ຍັງບໍ່ມີໜ້າ frontend), ຈຶ່ງ guard ດ້ວຍ 'supplies' ໃຫ້ຕົງກັບ API ຈິງ */}
        <Route path="/assets" element={<ProtectedRoute module="supplies"><AssetManagement /></ProtectedRoute>} />

        {/* ພື້ນທີ່ເຮັດວຽກ */}
        <Route path="/meeting-rooms" element={<ProtectedRoute module="rooms"><MeetingRooms /></ProtectedRoute>} />
        {/* ລາຍງານສະຖານະຫ້ອງຕົວຈິງ — check-in/out, ຜູ້ເຂົ້າຮ່ວມ, ຕໍ່ເວລາ — ອ່ານໄດ້ທຸກຄົນທີ່ມີສິດ rooms:read,
            ສ່ວນ check-in/checkout/attendees/reschedule ຄວບຄຸມ ownership ພາຍໃນ backend ເອງ (ບໍ່ແມ່ນທີ່ນີ້) */}
        <Route path="/room-status" element={<ProtectedRoute module="rooms"><RoomStatusReport /></ProtectedRoute>} />
        {/* ທະບຽນຊັບສິນບໍລິສັດ — ຄົນລະ module key ('assets') ຈາກ Supply Catalog ('supplies') ຢູ່ /assets */}
        <Route path="/asset-registry" element={<ProtectedRoute module="assets"><AssetRegistry /></ProtectedRoute>} />
        <Route path="/supplies" element={<ProtectedRoute module="supplies"><InventorySupplies /></ProtectedRoute>} />

        {/* ລະບົບ */}
        <Route path="/announcements" element={<ProtectedRoute module="announcements"><Announcements /></ProtectedRoute>} />
        {/* Notifications ແມ່ນຂໍ້ມູນສ່ວນຕົວຂອງແຕ່ລະຄົນ ບໍ່ຈຳກັດຕາມ module permission */}
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute module="reports"><Reports /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute module="audit-logs"><AuditLogs /></ProtectedRoute>} />
        {/* Settings ແມ່ນການຕັ້ງຄ່າສ່ວນຕົວ (ລະຫັດຜ່ານ, MFA, Session ຂອງຕົນເອງ) — backend ບໍ່ມີ module 'settings'
            ແຍກຕ່າງຫາກ, endpoint /sessions/me ທີ່ໜ້ານີ້ໃຊ້ບໍ່ຮຽກຮ້ອງ permission ໃດໆນອກຈາກ login */}
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        {/* ຖ້າພິມ URL ຜິດ ໃຫ້ສົ່ງກັບໄປໜ້າຫຼັກ (ເຊິ່ງຈະຖືກບັງຄັບໄປ Login ຖ້າຫາກຍັງບໍ່ທັນເຂົ້າສູ່ລະບົບ) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
