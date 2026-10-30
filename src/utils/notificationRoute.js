// ແປງ notification ໃຫ້ເປັນລິ້ງປາຍທາງ (ໜ້າ + popup ທີ່ຖືກຕ້ອງ)
// ໃຊ້ຮ່ວມກັນລະຫວ່າງ Navbar (ກະດິ່ງ) ແລະ ໜ້າ Notifications
export function getNotificationPath(n) {
  if (!n || !n.refModel) return null;
  const id = encodeURIComponent(n.refId || '');

  switch (n.refModel) {
    case 'Ticket':
      if (n.type === 'TICKET_DELETED') return '/issues';
      if (n.type === 'TICKET_MESSAGE') return `/issues/${id}/chat`;
      return `/issues/${id}`;

    case 'Announcement':
      return `/announcements?open=${id}`;

    case 'RoomBooking':
      // ຜູ້ອະນຸມັດ/ແອດມິນຂໍໃຫ້ປ່ຽນເວລາ ຫຼື ຫ້ອງ → ເປີດ popup ເລື່ອນເວລາ/ປ່ຽນຫ້ອງ ຂອງການຈອງນັ້ນເລີຍ
      if (n.type === 'ROOM_BOOKING_CHANGE_REQUESTED') {
        return `/meeting-rooms?tab=my-bookings&reschedule=${id}`;
      }
      return `/meeting-rooms?tab=my-bookings`;

    case 'SupplyRequest':
      // ພະນັກງານໃນແຜນກຂໍເບີກ → ແຈ້ງສະເພາະຫົວໜ້າແຜນກ ໃຫ້ເປີດແຖບ "ລໍຖ້າຫົວໜ້າພະແນກ" ຂອງໜ້າ /assets
      if (n.type === 'SUPPLY_REQUEST_MANAGER_REVIEW') {
        return `/assets?managerReview=${id}`;
      }
      // ຄຳຂໍເຂົ້າຄິວຝ່າຍສາງ (ຜູ້ອະນຸມັດ supplies:approve) → ເປີດ popup ໃນໜ້າ /assets
      if (n.type === 'SUPPLY_REQUEST_AWAITING_APPROVAL') {
        return `/assets?request=${id}`;
      }
      // ຫົວໜ້າອະນຸມັດ/ປະຕິເສດແລ້ວ → ຜູ້ຂໍເບິ່ງສະຖານະໃນໜ້າ /supplies
      if (n.type === 'SUPPLY_REQUEST_MANAGER_APPROVED' || n.type === 'SUPPLY_REQUEST_MANAGER_REJECTED') {
        return `/supplies?open=${id}`;
      }
      // ມີຄຳຂໍໃນນາມແຜນກ (ແຈ້ງຫົວໜ້າແຜນກ/ຜູ້ຮັບຜິດຊອບ) → ເປີດບັດລາຍລະອຽດໃບຂໍໃນໜ້າ /supplies
      if (n.type === 'SUPPLY_REQUEST_DEPARTMENT_CREATED') {
        return `/supplies?open=${id}`;
      }
      // ຖືກກຳນົດໃຫ້ໄປຮັບເຄື່ອງແທນ / ມີຄົນຮັບແທນ → ເປີດໃບຮັບເຄື່ອງຂອງໃບຂໍນັ້ນ
      return `/supplies/receipt/${id}`;

    default:
      return null;
  }
}
