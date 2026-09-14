"use client";

import { useState, useTransition, useRef } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Users,
  Tag,
  BookOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  parseLeadsSpreadsheet,
  commitLeadImport,
  type ParsedLeadRow,
  type ParseResult,
} from "@/lib/crm/leadImportActions";

export const SAMPLE_CSV_TEMPLATE =
  "\uFEFF" +
  [
    "Student Name,Phone Number,Email,Course,Batch,Tags,Status,Notes",
    'Rahul Sharma,9876543210,rahul.sharma@example.com,JEE Main & Advanced,Evening Batch (5 PM - 8 PM),"Hot Lead, Scholarship",New,Looking for 2-year classroom program',
    "Priya Verma,9812345678,priya.v@example.com,NEET Medical,Morning Batch (8 AM - 12 PM),Parent Interested,Messaged,Parent requested fee details on WhatsApp",
    "Aman Singh,9988776655,aman.singh@example.com,Class 10 CBSE,Weekend Batch,Referral,Contact Later,Call back on Sunday 4 PM",
    "Riya Gupta,9123456780,riya.g@example.com,Foundation Class 9,Regular Weekday,Scholarship,Converted,Paid registration amount Rs 5000",
  ].join("\r\n");

interface IsmUser {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  instituteId: string;
  isOpen: boolean;
  onClose: () => void;
  isms: { user: IsmUser }[];
}

export default function ExcelImportModal({
  instituteId,
  isOpen,
  onClose,
  isms,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  // Options
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [assignedIsmId, setAssignedIsmId] = useState<string>("");
  const [defaultCourse, setDefaultCourse] = useState("");
  const [defaultBatch, setDefaultBatch] = useState("");
  const [additionalTagsStr, setAdditionalTagsStr] = useState("");

  const [importStats, setImportStats] = useState<{
    importedCount: number;
    skippedDuplicateCount: number;
    errorCount: number;
    message: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", f);

    startTransition(async () => {
      const res = await parseLeadsSpreadsheet(instituteId, formData);
      if (res.success) {
        setParseResult(res);
        setStep("preview");
      } else {
        setErrorMessage(res.error || "Failed to parse file");
      }
    });
  }

  function handleDownloadSample() {
    try {
      const blob = new Blob([SAMPLE_CSV_TEMPLATE], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "sample_leads_template.csv");
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 200);
    } catch (err) {
      console.error("Failed to download template:", err);
    }
  }

  async function handleExecuteImport() {
    if (!parseResult || parseResult.validRows.length === 0) return;

    const tags = additionalTagsStr
      .split(/[,;|]/)
      .map((t: any) => t.trim())
      .filter(Boolean);

    startTransition(async () => {
      const res = await commitLeadImport({
        instituteId,
        leads: parseResult.validRows,
        skipDuplicates,
        assignedIsmId: assignedIsmId || null,
        defaultCourse: defaultCourse.trim() || null,
        defaultBatch: defaultBatch.trim() || null,
        additionalTags: tags,
        sendWelcomeEmail: false,
      });

      if (res.success) {
        setImportStats({
          importedCount: res.importedCount || 0,
          skippedDuplicateCount: res.skippedDuplicateCount || 0,
          errorCount: res.errorCount || 0,
          message: res.message || "Import completed",
        });
        setStep("done");
        router.refresh();
      } else {
        setErrorMessage(res.error || "Import failed");
      }
    });
  }

  function handleReset() {
    setFile(null);
    setParseResult(null);
    setStep("upload");
    setImportStats(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const duplicatesCount =
    parseResult?.validRows.filter((r: any) => r.isDuplicate).length || 0;
  const newLeadsCount =
    (parseResult?.validRows.length || 0) - duplicatesCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-lg">
                Import Leads from Excel / CSV
              </h3>
              <p className="text-xs text-stone-500">
                Bulk upload existing enquiries, old student databases, or walk-in records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-200 hover:border-emerald-500 rounded-3xl p-8 text-center cursor-pointer bg-stone-50/50 hover:bg-emerald-50/30 transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 bg-white shadow-xs rounded-2xl flex items-center justify-center mx-auto mb-3 text-stone-400 group-hover:text-emerald-600 group-hover:scale-110 transition">
                  {isPending ? (
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <h4 className="font-bold text-stone-800 text-sm">
                  {isPending ? "Parsing spreadsheet..." : "Click or drag spreadsheet here"}
                </h4>
                <p className="text-xs text-stone-400 mt-1">
                  Supports <strong>.xlsx</strong>, <strong>.xls</strong>, and <strong>.csv</strong> files
                </p>
              </div>

              {/* Sample Template Download */}
              <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-stone-800 block">
                    Need the standard column format?
                  </span>
                  <span className="text-stone-500">
                    Download our sample CSV template with columns for Name, Phone, Email, Course, Batch, Tags, and Status.
                  </span>
                </div>
                <button
                  onClick={handleDownloadSample}
                  type="button"
                  className="px-3.5 py-2 bg-white text-stone-700 hover:text-stone-900 border border-stone-200 hover:border-stone-300 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" /> Sample CSV
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Configuration */}
          {step === "preview" && parseResult && (
            <div className="space-y-4">
              {/* Summary Badges */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-stone-100 rounded-2xl">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                    Total Rows
                  </span>
                  <span className="text-xl font-black text-stone-800">
                    {parseResult.totalRows}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    New Valid Leads
                  </span>
                  <span className="text-xl font-black text-emerald-800">
                    {newLeadsCount}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                    Existing Duplicates
                  </span>
                  <span className="text-xl font-black text-amber-800">
                    {duplicatesCount}
                  </span>
                </div>
              </div>

              {/* Preview Table of First 5 rows */}
              <div className="border border-stone-200 rounded-2xl overflow-hidden text-xs">
                <div className="bg-stone-50 px-3.5 py-2 font-bold text-stone-600 border-b border-stone-200 flex justify-between items-center">
                  <span>Data Preview (First 5 Rows)</span>
                  <span className="text-[10px] text-stone-400 font-normal">
                    {file?.name}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-left">
                    <thead className="bg-stone-100/70 text-stone-500 font-semibold border-b border-stone-200 text-[11px]">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2">Course</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {parseResult.validRows.slice(0, 5).map((row: any, i: any) => (
                        <tr key={i} className="hover:bg-stone-50">
                          <td className="p-2 text-stone-400">{row.rowNumber}</td>
                          <td className="p-2 font-bold text-stone-800">
                            {row.name}
                          </td>
                          <td className="p-2 text-stone-600">
                            {row.phone}
                            {row.isDuplicate && (
                              <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                                Dup
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-stone-600">
                            {row.course || "—"}
                          </td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Settings */}
              <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl space-y-3">
                <h5 className="font-bold text-stone-800 text-xs uppercase tracking-wider">
                  Import Configuration
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Assign to Sales Manager */}
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3 text-violet-600" /> Assign Leads To:
                    </label>
                    <select
                      value={assignedIsmId}
                      onChange={(e) => setAssignedIsmId(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-violet-400 focus:outline-hidden"
                    >
                      <option value="">Leave Unassigned</option>
                      {isms.map((ism: any) => (
                        <option key={ism.user.id} value={ism.user.id}>
                          {ism.user.name || ism.user.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fallback Course */}
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 mb-1 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-blue-600" /> Default Course (if blank):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. JEE Main / Class 10"
                      value={defaultCourse}
                      onChange={(e) => setDefaultCourse(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-blue-400 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Additional Tags */}
                <div>
                  <label className="text-[11px] font-bold text-stone-600 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-600" /> Additional Tags for this Batch:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Old Students, 2025 Database, Walk-in Expo"
                    value={additionalTagsStr}
                    onChange={(e) => setAdditionalTagsStr(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-hidden"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-2 pt-2 border-t border-stone-200/60">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>
                      Skip {duplicatesCount} existing duplicate phone numbers
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Complete */}
          {step === "done" && importStats && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-stone-900 text-lg">
                Import Completed Successfully!
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {importStats.message}
              </p>

              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={() => {
                    onClose();
                    handleReset();
                  }}
                  className="px-6 py-2.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition"
                >
                  View Leads in Inbox →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
          {step === "preview" ? (
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="text-xs font-bold text-stone-500 hover:text-stone-800 px-3 py-2 rounded-xl transition"
              >
                ← Choose Another File
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isPending}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-xs"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Import{" "}
                    {skipDuplicates ? newLeadsCount : parseResult?.validRows.length}{" "}
                    Leads
                  </>
                )}
              </button>
            </>
          ) : step === "upload" ? (
            <div className="ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-bold text-stone-500 hover:text-stone-800 px-4 py-2 rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
