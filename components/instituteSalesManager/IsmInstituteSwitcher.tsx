"use client";

import React from "react";

export interface AssignmentOption {
  instituteId: string;
  institute: {
    name: string;
  };
}

interface Props {
  currentInstituteId: string;
  userId: string;
  assignments: AssignmentOption[];
}

export function IsmInstituteSwitcher({ currentInstituteId, userId, assignments }: Props) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <label className="text-[11px] font-bold text-slate-400 block mb-1">Active Institute:</label>
      <select
        defaultValue={currentInstituteId}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
          if (typeof window !== "undefined") {
            window.location.href = `/institute_sales/${e.target.value}/${userId}`;
          }
        }}
        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
      >
        {assignments.map((a: AssignmentOption) => (
          <option key={a.instituteId} value={a.instituteId}>
            {a.institute.name}
          </option>
        ))}
      </select>
    </div>
  );
}
