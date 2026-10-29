import { useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket';

export const INVENTORY_EVENT = 'inventory:changed';

/**
 * ໃຫ້ໜ້າຈໍດຶງຂໍ້ມູນໃໝ່ແບບ real-time ເມື່ອຂໍ້ມູນສາງ/ຊັບສິນປ່ຽນ (ຈາກຜູ້ໃຊ້ຄົນອື່ນ ຫຼື ໜ້າອື່ນ).
 *
 * - ຟັງ event `inventory:changed` ຈາກ server (socket.io)
 * - ດຶງໃໝ່ເມື່ອ socket ເຊື່ອມຕໍ່ຄືນ, ເມື່ອກັບມາທີ່ tab/ໜ້າຕ່າງ, ແລະເມື່ອ network ກັບມາ
 * - ຖ້າ socket ບໍ່ເຊື່ອມຕໍ່ (ຫຼືບໍ່ມີ) ຈະ poll ເປັນ fallback; ຖ້າ socket ປົກກະຕິ ຈະບໍ່ poll
 *   (ກັນບໍ່ໃຫ້ຍິງ API ຖີ່ເກີນ — server ມີ rate limit ຕໍ່ IP)
 * - ບໍ່ດຶງຊ້ອນກັນ: ຖ້າກຳລັງດຶງຢູ່ ແລ້ວມີ event ໃໝ່ມາ ຈະດຶງຕໍ່ອີກຮອບເມື່ອຮອບກ່ອນຈົບ
 *
 * `refresh` ຄວນເປັນການດຶງແບບ silent (ບໍ່ເປີດ spinner / ບໍ່ລ້າງຂໍ້ມູນເມື່ອ error) ແລະ return Promise.
 * ໃຊ້ refresh ລຸ້ນຫຼ້າສຸດສະເໝີ ຈຶ່ງອ່ານ state ປັດຈຸບັນ (filter/tab/search) ໄດ້ຖືກຕ້ອງ.
 */
export default function useRealtimeRefresh(
  refresh,
  { debounceMs = 300, fallbackPollMs = 20000, enabled = true } = {},
) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let disposed = false;
    let running = false;
    let queued = false;
    let timer = null;

    const exec = async () => {
      if (disposed) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        await refreshRef.current?.();
      } catch {
        // ການດຶງແບບ silent ລົ້ມ — ຮັກສາຂໍ້ມູນເດີມທີ່ສະແດງຢູ່, ຮອບຕໍ່ໄປຈະລອງໃໝ່
      } finally {
        running = false;
        if (queued && !disposed) {
          queued = false;
          exec();
        }
      }
    };

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(exec, debounceMs);
    };
    const whenVisible = () => {
      if (document.visibilityState === 'visible') run();
    };

    const socket = getSocket();
    if (socket) {
      socket.on(INVENTORY_EVENT, run);
      socket.io?.on('reconnect', run); // ຫຼົງ event ຕອນຫຼຸດ → ດຶງໃໝ່ເມື່ອກັບມາ
    }

    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (socket && socket.connected) return; // real-time ປົກກະຕິ — ບໍ່ຕ້ອງ poll
      run();
    }, fallbackPollMs);

    document.addEventListener('visibilitychange', whenVisible);
    window.addEventListener('focus', whenVisible);
    window.addEventListener('online', run);

    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(poll);
      if (socket) {
        socket.off(INVENTORY_EVENT, run);
        socket.io?.off('reconnect', run);
      }
      document.removeEventListener('visibilitychange', whenVisible);
      window.removeEventListener('focus', whenVisible);
      window.removeEventListener('online', run);
    };
  }, [debounceMs, fallbackPollMs, enabled]);
}
