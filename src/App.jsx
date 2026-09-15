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

        {/* ໂມດູນທັງໝົດທີ່ຕ້ອງ Login ກ່ອນຈຶ່ງເຂົ້າເບິ່ງໄດ້ (ໃຊ້ ProtectedRoute ຄອບ) */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/issues" element={<ProtectedRoute><Issues /></ProtectedRoute>} />
        <Route path="/sla-management" element={<ProtectedRoute><Slamanagement /></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute><RolesManagement /></ProtectedRoute>} />
        <Route path="/branches" element={<ProtectedRoute><BranchesManagement /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/assets" element={<ProtectedRoute><AssetManagement /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UsersManagement /></ProtectedRoute>} />
        <Route path="/meeting-rooms" element={<ProtectedRoute><MeetingRooms /></ProtectedRoute>} />
        <Route path="/supplies" element={<ProtectedRoute><InventorySupplies /></ProtectedRoute>} />
        <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
        <Route path="/ticket-types" element={<ProtectedRoute><TicketTypesManagement /></ProtectedRoute>} />
        <Route path="/issues/:id/chat" element={<ProtectedRoute><TicketChat /></ProtectedRoute>} />

        {/* ຖ້າພິມ URL ຜິດ ໃຫ້ສົ່ງກັບໄປໜ້າຫຼັກ (ເຊິ່ງຈະຖືກບັງຄັບໄປ Login ຖ້າຫາກຍັງບໍ່ທັນເຂົ້າສູ່ລະບົບ) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}