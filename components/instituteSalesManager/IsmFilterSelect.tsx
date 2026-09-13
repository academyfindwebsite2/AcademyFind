"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface IsmFilterSelectProps {
  currentIsm: string;
  activeIsms: {
    userId: string;
    user: {
      name: string | null;
      email: string | null;
    };
  }[];
}

export default function IsmFilterSelect({ currentIsm, activeIsms }: IsmFilterSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (val === "ALL") {
      params.delete("ism");
    } else {
      params.set("ism", val);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : window.location.pathname);
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-bold text-stone-500 whitespace-nowrap">Filter by ISM:</label>
      <select
        value={currentIsm}
        onChange={handleChange}
        className="text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-stone-800 focus:ring-2 focus:ring-violet-400 outline-none cursor-pointer"
      >
        <option value="ALL">All Sales Managers</option>
        <option value="UNASSIGNED">Unassigned Only</option>
        {activeIsms.map((ism) => (
          <option key={ism.userId} value={ism.userId}>
            {ism.user.name || ism.user.email}
          </option>
        ))}
      </select>
    </div>
  );
}
