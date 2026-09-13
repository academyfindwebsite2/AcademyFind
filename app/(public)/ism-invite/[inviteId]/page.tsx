import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { formatIST } from "@/lib/utils";
import { Building2, UserCheck, Clock, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import IsmInviteResponseClient from "./IsmInviteResponseClient";

export default async function IsmInvitePage({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/login?redirect=/ism-invite/${inviteId}`);

  const invite = await prisma.ismInviteRequest.findUnique({
    where: { id: inviteId },
    include: {
      institute: { select: { id: true, name: true, logo: true, address: true } },
      sentBy: { select: { name: true, image: true } },
      user: { select: { id: true, name: true } },
    },
  });

  if (!invite) return notFound();

  // Redirect if this isn't the invited user
  if (invite.userId !== session.user.id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center bg-white rounded-3xl border border-red-200 shadow-sm p-10">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-extrabold text-slate-900 mb-2">Unauthorized</h1>
          <p className="text-sm text-slate-500">This invite was sent to a different user.</p>
        </div>
      </div>
    );
  }

  const isAlreadyISM = await prisma.instituteSalesManagerAssignment.findUnique({
    where: { userId_instituteId: { userId: session.user.id, instituteId: invite.instituteId } },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-900 to-indigo-800 px-8 py-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full blur-3xl pointer-events-none" />
          <p className="text-violet-300 text-sm font-semibold uppercase tracking-wider mb-1">Institute Sales Manager Invite</p>
          <h1 className="text-2xl font-extrabold">You've been invited! 🎯</h1>
          <p className="text-violet-200 text-sm mt-1">
            Sent {formatIST(invite.createdAt, "dd MMM yyyy · hh:mm a")}
          </p>
        </div>

        <div className="p-8 space-y-6">
          {/* Institute Info */}
          <div className="flex items-center gap-4 p-4 bg-violet-50 border border-violet-100 rounded-2xl">
            {invite.institute.logo ? (
              <img src={invite.institute.logo} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-violet-100" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-violet-200 text-violet-800 flex items-center justify-center font-extrabold text-xl shrink-0">
                {invite.institute.name[0]}
              </div>
            )}
            <div>
              <p className="font-extrabold text-slate-900 text-lg">{invite.institute.name}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {invite.institute.address}
              </p>
            </div>
          </div>

          {/* Sent by */}
          <div className="flex items-center gap-3">
            {invite.sentBy.image ? (
              <img src={invite.sentBy.image} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center">
                {invite.sentBy.name?.[0] || "?"}
              </div>
            )}
            <p className="text-sm text-slate-600">
              Invited by <span className="font-bold text-slate-900">{invite.sentBy.name || "Institute Manager"}</span>
            </p>
          </div>

          {/* Message */}
          {invite.message && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Message from manager
              </p>
              <p className="text-sm text-slate-700 italic">"{invite.message}"</p>
            </div>
          )}

          {/* What this means */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">What happens if you accept:</p>
            <ul className="space-y-2">
              {[
                "Your account role is upgraded to Institute Sales Manager",
                `You'll be added to ${invite.institute.name}'s sales team`,
                "You can log in to manage and convert leads for this institute",
                "You can be assigned to multiple institutes as an ISM",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Status / Action */}
          {invite.status !== "PENDING" ? (
            <div className={`flex items-center gap-3 p-4 rounded-2xl border font-bold ${
              invite.status === "ACCEPTED"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {invite.status === "ACCEPTED"
                ? <><CheckCircle2 className="w-5 h-5" /> You accepted this invite!</>
                : <><XCircle className="w-5 h-5" /> You declined this invite.</>
              }
            </div>
          ) : isAlreadyISM?.isActive ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl border bg-green-50 border-green-200 text-green-800 font-bold">
              <CheckCircle2 className="w-5 h-5" /> You're already an active ISM for this institute.
            </div>
          ) : (
            <IsmInviteResponseClient inviteId={inviteId} instituteName={invite.institute.name} instituteId={invite.instituteId} />
          )}
        </div>

      </div>
    </div>
  );
}
