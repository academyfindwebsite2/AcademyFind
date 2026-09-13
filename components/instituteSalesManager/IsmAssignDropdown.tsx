"use client";

import { useState, useTransition } from "react";
import { assignLeadToIsm } from "@/lib/instituteSalesManager/ismActions";
import { UserCheck, Loader2, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface Ism {
  userId: string;
  user: { id?: string; name: string | null; email?: string | null };
}

interface Props {
  enquiryId: string;
  instituteId: string;
  currentIsmId: string | null;
  isms: Ism[];
}

export default function IsmAssignDropdown({ enquiryId, instituteId, currentIsmId, isms }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIsmId, setSelectedIsmId] = useState(currentIsmId || "");
  const [saved, setSaved] = useState(false);

  function handleAssign(value: string) {
    setSelectedIsmId(value);
    setSaved(false);
    startTransition(async () => {
      await assignLeadToIsm(enquiryId, value || null);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  if (isms.length === 0) {
    return (
      <span className="text-[10px] text-slate-400 italic">No ISMs in team</span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
      ) : saved ? (
        <UserCheck className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <UserCheck className="w-3.5 h-3.5 text-slate-300" />
      )}
      <div className="relative">
        <select
          value={selectedIsmId}
          onChange={(e) => handleAssign(e.target.value)}
          disabled={isPending}
          className="appearance-none pl-2 pr-6 py-1 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer disabled:opacity-50 max-w-[130px] truncate"
        >
          <option value="">Unassigned</option>
          {isms.map((ism) => (
            <option key={ism.userId} value={ism.userId}>
              {ism.user.name || ism.user.email}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}
