import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import { ArrowLeft, UserCheck, Clock, MapPin, Building2, User, Phone, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import ApprovalButtons from "@/components/admin/AdminApprovalButtons";
import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import { deleteInstituteRequestAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import AdminRequestStatusForm from "@/components/admin/AdminRequestStatusForm";
import AdminClaimWhatsAppButton from "@/components/admin/AdminClaimWhatsAppButton";
import AdminRequestNotifyButton from "@/components/admin/AdminRequestNotifyButton";

export default async function InstituteRequestDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;

    const request = await prisma.instituteRequest.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    role: true,
                }
            },
            institute: {
                include: {
                    city: true,
                    categories: {
                        include: { category: true }
                    },
                    claims: true,
                }
            }
        }
    });

    if (!request) {
        notFound();
    }

    const claim = request.institute?.claims?.[0];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back Link */}
            <Link href="/af-ass-manage/instituteRequests" className="inline-flex items-center text-xs text-stone-500 hover:text-stone-800 transition-colors font-semibold">
                <ArrowLeft className="w-3 h-3 mr-1" /> Back to All Requests
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
                        Request Details
                    </h1>
                    <p className="text-sm text-stone-500 mt-1 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {formatIST(request.createdAt, "PPP 'at' p")}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        request.status === 'APPROVED' ? 'bg-green-100 text-green-700 border border-green-200' :
                        request.status === 'REJECTED' ? 'bg-red-100 text-red-700 border border-red-200' :
                        request.status === 'CALL_BACK' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                        request.status === 'FOLLOW_UP' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                        'bg-stone-100 text-stone-700 border border-stone-200'
                    }`}>
                        {request.status}
                    </span>
                    {request.status === 'APPROVED' && (
                        <AdminRequestNotifyButton request={request} />
                    )}
                    {request.status === "PENDING" && request.institute && (
                        <ApprovalButtons requestId={request.id} />
                    )}
                    <AdminDeleteButton id={request.id} onDelete={deleteInstituteRequestAction} title="Delete Request" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Submitter & Request Meta */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-stone-200 overflow-hidden">
                        <CardHeader className="bg-stone-50/50 border-b border-stone-100 pb-4">
                            <CardTitle className="text-sm font-bold text-stone-800 flex items-center gap-2">
                                <User className="w-4 h-4 text-stone-400" /> Submitted By (User)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            {request.user ? (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Name</div>
                                        <div className="font-semibold text-stone-800">{request.user.name || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Email</div>
                                        <div className="font-medium text-stone-600">{request.user.email}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Phone</div>
                                        <div className="font-medium text-stone-600">{request.user.phone || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Role</div>
                                        <div className="font-medium text-stone-600">{request.user.role}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-rose-500 font-semibold italic">User account no longer exists.</div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-stone-200 overflow-hidden">
                        <CardHeader className="bg-sky-50/50 border-b border-sky-100 pb-4">
                            <CardTitle className="text-sm font-bold text-sky-900 flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-sky-600" /> Owner Details (Provided in form)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            {(request.ownerName || request.ownerPhone || request.ownerDesignation) ? (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Owner Name</div>
                                        <div className="font-semibold text-stone-800">{request.ownerName || "—"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Owner Phone</div>
                                        <div className="font-semibold text-stone-800 flex items-center gap-2 flex-wrap">
                                            <span>{request.ownerPhone || "—"}</span>
                                            {request.ownerPhone && (
                                                <AdminClaimWhatsAppButton
                                                    phone={request.ownerPhone}
                                                    managerName={request.ownerName || "Owner"}
                                                    instituteName={request.institute?.name}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Designation</div>
                                        <div className="font-medium text-stone-600">{request.ownerDesignation || "—"}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-stone-500 italic">No specific owner details were provided.</div>
                            )}
                        </CardContent>
                    </Card>

                    {claim && (
                        <Card className="shadow-sm border-stone-200 overflow-hidden">
                            <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 pb-4">
                                <CardTitle className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-emerald-600" /> Attached Claim Request
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Claimer Name</div>
                                        <div className="font-semibold text-stone-800">{claim.fullName}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Claimer Phone</div>
                                        <div className="font-semibold text-stone-800 flex items-center gap-2 flex-wrap">
                                            <span>{claim.phone}</span>
                                            <AdminClaimWhatsAppButton
                                                phone={claim.phone}
                                                managerName={claim.fullName}
                                                instituteName={request.institute?.name}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Role</div>
                                        <div className="font-medium text-stone-600">{claim.role}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Status</div>
                                        <div className="font-bold text-emerald-700">{claim.status}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="shadow-sm border-stone-200 overflow-hidden">
                        <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
                            <CardTitle className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Status & Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            <AdminRequestStatusForm 
                                requestId={request.id} 
                                initialStatus={request.status} 
                                initialNotes={request.adminNotes} 
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Institute Meta */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-stone-200 overflow-hidden h-full">
                        <CardHeader className="bg-purple-50/50 border-b border-purple-100 pb-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold text-purple-900 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-purple-600" /> Institute Details Overview
                            </CardTitle>
                            {request.institute && (
                                <Link 
                                    href={`/af-ass-manage/institutes/${request.institute.id}`} 
                                    className="text-xs font-bold text-purple-600 hover:text-purple-700 bg-white border border-purple-200 px-3 py-1.5 rounded-lg shadow-sm transition-all"
                                >
                                    View Full Institute Page
                                </Link>
                            )}
                        </CardHeader>
                        <CardContent className="p-5 space-y-5">
                            {request.institute ? (
                                <>
                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Institute Name</div>
                                        <div className="text-lg font-extrabold text-stone-900">{request.institute.name}</div>
                                        <div className="text-xs font-mono text-stone-400 mt-1">Slug: {request.institute.slug}</div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Provider Type</div>
                                            <div className="font-semibold text-stone-800">{request.institute.providerType || "INSTITUTE"}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Location</div>
                                            <div className="font-semibold text-stone-800 flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-stone-400" /> 
                                                {request.institute.city?.name || "N/A"}
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-2">Categories</div>
                                        <div className="flex flex-wrap gap-2">
                                            {request.institute.categories.length > 0 ? request.institute.categories.map((c: any) => (
                                                <span key={c.category.id} className="text-[10px] uppercase tracking-wider font-bold bg-stone-100 text-stone-700 px-2 py-1 rounded">
                                                    {c.category.name}
                                                </span>
                                            )) : (
                                                <span className="text-sm text-stone-400 italic">No categories</span>
                                            )}
                                        </div>
                                    </div>

                                    <Separator />

                                    <div>
                                        <div className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-2">Contact Info</div>
                                        <div className="space-y-1.5 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-3.5 h-3.5 text-stone-400" />
                                                <span className="font-medium text-stone-700">{request.institute.phone || "N/A"}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <User className="w-3.5 h-3.5 text-stone-400" />
                                                <span className="font-medium text-stone-700">{request.institute.email || "N/A"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12 space-y-3">
                                    <XCircle className="w-12 h-12 text-rose-300 mx-auto" />
                                    <p className="text-sm text-stone-500 font-medium">The associated institute profile has been deleted.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
