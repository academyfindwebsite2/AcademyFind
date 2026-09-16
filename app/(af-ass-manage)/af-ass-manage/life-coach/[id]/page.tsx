import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { User, Phone, Mail, Clock, MessageSquare, ArrowLeft, MessageCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import StatusUpdater from "@/components/admin/AdminLifeCoachStatusUpdater";
import { formatIST, formatWhatsAppNumber } from "@/lib/utils";
import { buildLifeCoachWhatsAppMessage } from "@/lib/notifications/lifeCoachTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function LifeCoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const request = await prisma.lifeCoachRequest.findUnique({
    where: { id },
  });

  if (!request) notFound();

  return (
    <div className="w-full space-y-6 max-w-4xl mx-auto p-4 md:p-8">
      <Link href="/af-ass-manage/life-coach" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors font-semibold">
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>

      <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">

        {/* Header & Status Updater */}
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-stone-50/50 pb-6">
          <div>
            <CardTitle className="text-2xl font-bold text-stone-900">Counseling Request</CardTitle>
            <p className="text-sm text-stone-500 font-mono mt-2 bg-white px-2 py-1 rounded border border-stone-200 w-fit">ID: {request.id}</p>
          </div>

          <StatusUpdater requestId={request.id} currentStatus={request.status as any} currentNotes={request.notes} />
        </CardHeader>
        <Separator className="bg-stone-100" />

        <CardContent className="p-6 md:p-8">
          {/* Lead Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Student Information</h3>

              <div className="bg-stone-50 rounded-2xl p-5 space-y-4 border border-stone-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm"><User className="w-4 h-4 text-stone-600" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase">Full Name</p>
                    <p className="font-semibold text-stone-800">{request.fullName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm"><Phone className="w-4 h-4 text-stone-600" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase">Phone Number</p>
                    <a href={`tel:${request.phone}`} className="font-semibold text-emerald-700 hover:underline">{request.phone}</a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm"><Mail className="w-4 h-4 text-stone-600" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase">Email Address</p>
                    <a href={`mailto:${request.email}`} className="font-semibold text-blue-700 hover:underline">{request.email}</a>
                  </div>
                </div>

                {request.phone && (
                  <div className="pt-2 border-t border-stone-200/60">
                    <a
                      href={`https://wa.me/${formatWhatsAppNumber(request.phone)}?text=${encodeURIComponent(
                        buildLifeCoachWhatsAppMessage({ fullName: request.fullName })
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4" /> Open WhatsApp Chat with Template
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Query Details</h3>

              <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-stone-500" />
                  <span className="font-bold text-stone-800 text-sm">Message / Dilemma</span>
                </div>
                <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap flex-1 break-words">
                  {request.message ? (
                    request.message.split(/(https?:\/\/[^\s]+)/g).map((part: any, i: any) =>
                      /(https?:\/\/[^\s]+)/g.test(part) ? (
                        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                          {part}
                        </a>
                      ) : (
                        part
                      )
                    )
                  ) : (
                    <span className="italic text-stone-400">No specific message provided. Please call to ask.</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-stone-100 text-xs text-stone-400 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Requested on {formatIST(request.createdAt)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}