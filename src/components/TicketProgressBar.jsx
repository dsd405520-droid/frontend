import React from 'react';
import { Check } from 'lucide-react';

export const TICKET_STEPS = [
    { key: 'OPEN', label: 'ແຈ້ງເຂົ້າມາ' },
    { key: 'ASSIGNED', label: 'ມອບໝາຍແລ້ວ' },
    { key: 'IN_PROGRESS', label: 'ກຳລັງແກ້ໄຂ' },
    { key: 'RESOLVED', label: 'ແກ້ໄຂແລ້ວ' },
    { key: 'CLOSED', label: 'ປິດແລ້ວ' },
];

const STATUS_STEP_INDEX = {
    OPEN: 0,
    ASSIGNED: 1,
    IN_PROGRESS: 2,
    WAITING_ON_USER: 2,
    RESOLVED: 3,
    CLOSED: 4,
};

export default function TicketProgressBar({ status, compact = false }) {
    const isClosed = status === 'CLOSED';
    const isWaiting = status === 'WAITING_ON_USER';
    const currentIndex = STATUS_STEP_INDEX[status] ?? 0;

    if (compact) {
        return (
            <div className="flex items-center gap-3">
                {TICKET_STEPS.map((step, idx) => {
                    const isLast = idx === TICKET_STEPS.length - 1;
                    const isDone = isClosed || idx < currentIndex;
                    const isCurrent = !isDone && idx === currentIndex;
                    const textColor = isDone
                        ? 'text-emerald-600'
                        : isCurrent
                            ? isWaiting ? 'text-amber-600' : 'text-blue-600'
                            : 'text-gray-400';

                    return (
                        <React.Fragment key={step.key}>
                            <span className={`text-xs whitespace-nowrap ${textColor} ${isCurrent ? 'font-semibold' : ''}`}>
                                {idx + 1} {step.label}
                                {isCurrent && isWaiting && ' (ລໍຖ້າຜູ້ໃຊ້)'}
                            </span>
                            {!isLast && <div className={`flex-1 h-px ${isDone ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex items-start">
            {TICKET_STEPS.map((step, idx) => {
                const isLast = idx === TICKET_STEPS.length - 1;
                const isDone = isClosed || idx < currentIndex;
                const isCurrent = !isDone && idx === currentIndex;
                const isHighlighted = isCurrent || (isClosed && isLast);

                return (
                    <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center text-center w-20">
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isDone
                                    ? 'bg-emerald-500 text-white'
                                    : isCurrent
                                        ? isWaiting
                                            ? 'bg-amber-100 text-amber-600 ring-4 ring-amber-100 animate-pulse'
                                            : 'bg-blue-500 text-white ring-4 ring-blue-100'
                                        : 'bg-gray-100 text-gray-300'
                                    }`}
                            >
                                {isDone ? <Check size={18} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                            </div>
                            <span className={`text-[11px] mt-1.5 leading-tight ${isHighlighted ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
                                {step.label}
                            </span>
                            {isCurrent && isWaiting && (
                                <span className="text-[10px] text-amber-600 font-medium mt-0.5">ລໍຖ້າຜູ້ໃຊ້</span>
                            )}
                        </div>
                        {!isLast && (
                            <div className={`flex-1 h-0.5 mt-4 ${isClosed || idx < currentIndex ? 'bg-emerald-500' : 'bg-gray-100'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}