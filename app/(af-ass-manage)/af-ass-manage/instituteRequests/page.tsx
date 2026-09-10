import { formatIST } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { Check, X, ShieldAlert, MapPin, BadgeIndianRupee, UserCheck, Filter, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ApprovalButtons from "@/components/admin/AdminApprovalButtons";
import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import AdminRequestNotifyButton from "@/components/admin/AdminRequestNotifyButton";
import { deleteInstituteRequestAction } from "./actions";

export default async function AdminApprovalsPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | undefined }>
}) {
    const params = await searchParams;
    // 🚀 Default filter is PENDING so admin sees action items first
    const currentFilter = params.status || 'PENDING';

    // Build filter condition
    const whereCondition: any = {};
    if (currentFilter !== 'ALL') {
        whereCondition.status = currentFilter;
    }

    const requests = await prisma.instituteRequest.findMany({
        where: whereCondition,
        include: {
            user: true,
            institute: {
                include: {
                    city: true,
                    categories: { include: { category: true } },
                    // Fetch Pending claims to display in the card
                    claims: { where: { status: "PENDING" } }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    const filterOptions = [
        { label: "All", value: "ALL" },
        { label: "Pending", value: "PENDING" },
        { label: "Call Back", value: "CALL_BACK" },
        { label: "Follow Up", value: "FOLLOW_UP" },
        { label: "Approved", value: "APPROVED" },
        { label: "Rejected", value: "REJECTED" },
    ];

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 font-sans">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Listing Approvals</h1>
                        <p className="text-sm text-slate-500">Review user-submitted setups and their claim requests. (Showing: {currentFilter})</p>
                    </div>
                </div>
                <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-xl font-bold text-sm shrink-0">
                    Total Requests: {requests.length}
                </div>
            </div>

            {/* 🚀 Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <div className="text-sm font-bold text-slate-400 flex items-center gap-1.5 mr-2">
                    <Filter className="w-4 h-4" /> Filter:
                </div>
                {filterOptions.map((opt: any) => (
                    <Link
                        key={opt.value}
                        prefetch={false}
                        href={`/af-ass-manage/instituteRequests?status=${opt.value}`}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${currentFilter === opt.value
                            ? "bg-stone-900 text-white shadow-md shadow-stone-900/20 scale-105"
                            : "bg-white border border-stone-100 text-slate-500 hover:bg-stone-50 hover:text-stone-700 hover:border-stone-200"
                            }`}
                    >
                        {opt.label}
                    </Link>
                ))}
            </div>

            {requests.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed rounded-3xl text-slate-400 font-medium bg-slate-50/50">
                    {currentFilter === 'PENDING'
                        ? "Great job! No pending verification requests in the queue."
                        : `No listing requests found for "${currentFilter}".`}
                </div>
            ) : (
                <div className="space-y-6">
                    {requests.map((req: any) => {
                        const claim = req.institute?.claims?.[0]; // Get the attached claim

                        return (
                            <div key={req.id} className="bg-white border rounded-3xl shadow-xs overflow-hidden border-slate-200">

                                <div className="p-4 bg-slate-50 border-b flex flex-wrap justify-between items-center gap-2 text-xs text-slate-500">
                                    <div>Submitted by: <span className="font-bold text-slate-800">{req.user?.name}</span> ({req.user?.email})</div>
                                    <div className="flex items-center gap-3">
                                        <div className="font-mono">{formatIST(req.createdAt)}</div>
                                        {/* 🚀 Status Badge */}
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                            req.status === 'APPROVED' ? 'bg-green-100 text-green-700 border border-green-200' :
                                            req.status === 'REJECTED' ? 'bg-red-100 text-red-700 border border-red-200' :
                                            req.status === 'CALL_BACK' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                            req.status === 'FOLLOW_UP' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                            'bg-stone-100 text-stone-700 border border-stone-200'
                                        }`}>
                                            {req.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-6 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
                                    {/* Banner Preview */}
                                    <div className="w-full h-32 md:h-full rounded-2xl bg-slate-100 relative overflow-hidden border">
                                        {req.institute?.imageUrl ? (
                                            <Image src={req.institute.imageUrl} alt="preview" fill className="object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">No Cover</div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            {req.institute ? (
                                                <>
                                                    <Link prefetch={false} href={`/af-ass-manage/institutes/${req.institute.id}`} className="hover:text-purple-600 transition-colors">
                                                        <h2 className="text-xl font-bold text-slate-900">{req.institute.name}</h2>
                                                    </Link>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <p className="text-xs text-slate-400 font-mono">slug: {req.institute.slug}</p>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${req.institute.providerType === 'INDIVIDUAL' ? 'bg-stone-50 text-stone-700 border border-stone-200/50 shadow-sm' : 'bg-indigo-100 text-indigo-700'}`}>
                                                            {req.institute.providerType || 'INSTITUTE'}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <h2 className="text-xl font-bold text-red-500 italic">Institute Deleted</h2>
                                            )}
                                        </div>

                                        {/* Categories */}
                                        {req.institute?.categories && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {req.institute.categories.map((c: any) => (
                                                    <span key={c.category.id} className="text-[10px] uppercase tracking-wide bg-purple-50 text-purple-700 font-bold px-2.5 py-1 rounded-md border border-purple-100">
                                                        {c.category.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <p className="text-sm text-slate-600 bg-slate-50/80 p-3 rounded-xl border leading-relaxed line-clamp-2">
                                            {req.institute?.description || "No description provided."}
                                        </p>

                                        {/* 🚀 SMART UI: Show Claim Info if it exists */}
                                        {claim && (
                                            <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl flex items-start gap-3">
                                                <UserCheck className="w-5 h-5 text-stone-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="text-xs font-bold text-stone-900 uppercase">Attached Claim Request</h4>
                                                    <div className="text-xs text-stone-800 mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                                                        <p>Role: <span className="font-semibold">{claim.role}</span></p>
                                                        <p>Phone: <span className="font-semibold">{claim.phone}</span></p>
                                                        <p>Name: <span className="font-semibold">{claim.fullName}</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(req.ownerName || req.ownerPhone || req.ownerDesignation) && (
                                            <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl flex items-start gap-3">
                                                <UserCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="text-xs font-bold text-sky-900 uppercase">Owner Details</h4>
                                                    <div className="text-xs text-sky-800 mt-1 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1">
                                                        <p>Name: <span className="font-semibold">{req.ownerName || "N/A"}</span></p>
                                                        <p>Phone: <span className="font-semibold">{req.ownerPhone || "N/A"}</span></p>
                                                        <p>Designation: <span className="font-semibold">{req.ownerDesignation || "N/A"}</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {req.institute && (
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-700">
                                                <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-emerald-500" /> {req.institute.city?.name}</div>
                                                <div className="flex items-center gap-1.5"><BadgeIndianRupee className="w-4 h-4 text-stone-500" /> Fees: {req.institute.feeInfo || "N/A"}</div>
                                            </div>
                                        )}

                                        <div className="pt-2 flex flex-wrap justify-end items-center gap-2">
                                            <Link 
                                                href={`/af-ass-manage/instituteRequests/${req.id}`} 
                                                className="px-4 py-2 text-sm font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-full transition-all flex items-center gap-2 border border-indigo-200"
                                            >
                                                <ExternalLink className="w-4 h-4" /> View Request Details
                                            </Link>

                                            {req.institute && (
                                                <Link 
                                                    href={`/af-ass-manage/institutes/${req.institute.id}`} 
                                                    className="px-4 py-2 text-sm font-bold bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-full transition-all flex items-center gap-2 border border-stone-200"
                                                >
                                                    <ExternalLink className="w-4 h-4" /> View Institute
                                                </Link>
                                            )}

                                            {/* Show Notify Manager button if approved */}
                                            {req.status === "APPROVED" && (
                                                <AdminRequestNotifyButton request={req} />
                                            )}

                                            {/* Only show approval buttons if the request is still PENDING */}
                                            {req.status === "PENDING" && req.institute && (
                                                <ApprovalButtons requestId={req.id} />
                                            )}
                                            
                                            <AdminDeleteButton id={req.id} onDelete={deleteInstituteRequestAction} title="Delete Request?" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}