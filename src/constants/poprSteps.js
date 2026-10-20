// ຂະບວນການ POPR ສຳລັບການຈັດຫາ → ຮັບເຂົ້າ → ຕຽມ → ປ່ອຍ ອຸປະກອນ
// P = Procurement (ຈັດຫາ/ຈັດຊື້) · O = Onboarding (ຮັບເຂົ້າ/ຕ້ອນຮັບ) · P = Preparation (ຕຽມ/ກຳນົດຄ່າ) · R = Release (ປ່ອຍ/ລົງທະບຽນ)
export const POPR_STEPS = [
    {
        key: 'PROCUREMENT',
        code: 'P',
        label: 'ການຈັດຫາ/ຈັດຊື້',
        desc: 'ກວດສອບຂໍ້ກຳນົດ, ເລືອກຜູ້ຂາຍ, ອອກໃບສັ່ງຊື້ (PO)',
    },
    {
        key: 'RECEIVING',
        code: 'O',
        label: 'ການຮັບເຂົ້າ/ຕ້ອນຮັບ',
        desc: 'ກວດທາງກາຍ, ຕິດແທັກສິນຊັບ, ລົງທະບຽນການຈັດການສິນຊັບ',
    },
    {
        key: 'PREPARATION',
        code: 'P',
        label: 'ການຕຽມ/ກຳນົດຄ່າ',
        desc: 'ຕິດຕັ້ງ OS/ຊອບແວ, ຄວບຄຸມການເຂົ້າເຖິງ, ເສີມຄວາມປອດໄພ/ເຂົ້າລະຫັດ',
    },
    {
        key: 'RELEASE',
        code: 'R',
        label: 'ການປ່ອຍ/ລົງທະບຽນ',
        desc: 'ສົ່ງມອບ, ແນະນຳຜູ້ໃຊ້, ອັບເດດສະຖານະເປັນກຳລັງໃຊ້ງານ',
    },
];

export const POPR_STATUS = {
    DRAFT: { label: 'ຮ່າງ', className: 'bg-gray-100 text-gray-600' },
    IN_PROGRESS: { label: 'ກຳລັງດຳເນີນການ', className: 'bg-amber-100 text-amber-700' },
    COMPLETED: { label: 'ສຳເລັດ', className: 'bg-emerald-100 text-emerald-700' },
};

// ປະເພດອຸປະກອນ:
//  ELECTRONIC = ຕ້ອງມີ S/N ຕໍ່ໜ່ວຍ, OS, ຄວາມປອດໄພ · GENERAL = ຊັບສິນທົ່ວໄປ (ບໍ່ຕ້ອງ S/N/OS)
//  CONSUMABLE = ວັດສະດຸສິ້ນເປືອງ — ເຂົ້າຄັງ (ບວກສະຕ໊ອກ) ບໍ່ສ້າງຊັບສິນ ແລະ ບໍ່ຕ້ອງມີຜູ້ຮັບ
export const POPR_ITEM_TYPE = {
    ELECTRONIC: { label: 'ອຸປະກອນໄອທີ / ເອເລັກໂທຣນິກ', className: 'bg-blue-100 text-blue-700' },
    GENERAL: { label: 'ອຸປະກອນທົ່ວໄປ', className: 'bg-gray-100 text-gray-600' },
    CONSUMABLE: { label: 'ວັດສະດຸສິ້ນເປືອງ (ເຂົ້າຄັງ)', className: 'bg-purple-100 text-purple-700' },
};

// ສະຖານະຍ່ອຍພາຍໃນໄລຍະ P (ຈັດຫາ/ຈັດຊື້): PENDING → PROCESS
export const POPR_ORDER_STATUS = {
    PENDING: { label: 'ລໍຖ້າດຳເນີນການ (PENDING)', className: 'bg-amber-100 text-amber-700' },
    PROCESS: { label: 'ກຳລັງດຳເນີນການ (PROCESS)', className: 'bg-blue-100 text-blue-700' },
};

// ສະຖານະຍ່ອຍພາຍໃນໄລຍະ O (ຮັບເຂົ້າ/ຕ້ອນຮັບ): SHIPPING → REVIEW → RECEIVED
export const POPR_DELIVERY_STATUS = {
    SHIPPING: { label: 'ກຳລັງສົ່ງ (SHIPPING)', className: 'bg-blue-100 text-blue-700' },
    REVIEW: { label: 'ກວດສອບ (REVIEW)', className: 'bg-amber-100 text-amber-700' },
    RECEIVED: { label: 'ຮັບຮຽບຮ້ອຍ (RECEIVED)', className: 'bg-emerald-100 text-emerald-700' },
};