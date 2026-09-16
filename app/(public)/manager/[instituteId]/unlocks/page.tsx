import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import {
  KeyRound,
  Phone,
  Globe,
  Mail,
  Share2,
  Sparkles,
  Search,
  MessageCircle,
  Coins,
  ArrowUpRight,
  User,
  ExternalLink,
  Flame,
} from "lucide-react";

const getUnlockTypeBadge = (type: string) => {
  const t = type.toUpperCase();
  switch (t) {
    case "PHONE":
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <Phone className="w-3.5 h-3.5 mr-1" />,
        label: "Phone Number",
      };
    case "WEBSITE":
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        icon: <Globe className="w-3.5 h-3.5 mr-1" />,
        label: "Website",
      };
    case "EMAIL":
      return {
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        icon: <Mail className="w-3.5 h-3.5 mr-1" />,
        label: "Email",
      };
    case "SOCIAL":
      return {
        bg: "bg-pink-50 text-pink-700 border-pink-200",
        icon: <Share2 className="w-3.5 h-3.5 mr-1" />,
        label: "Social Profiles",
      };
    case "COMMUNITY":
      return {
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <Sparkles className="w-3.5 h-3.5 mr-1" />,
        label: "Community/Features",
      };
    default:
      return {
        bg: "bg-stone-50 text-stone-700 border-stone-200",
        icon: <KeyRound className="w-3.5 h-3.5 mr-1" />,
        label: type,
      };
  }
};

export default async function ManagerUnlocksPage({
  params,
  searchParams,
}: {
  params: Promise<{ instituteId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { instituteId } = await params;
  const sParams = await searchParams;
  const currentType = sParams.type || "ALL";
  const searchQuery = sParams.q?.trim() || "";

  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: { id: true, name: true, slug: true, subscriptionPlan: true, isVerified: true },
  });

  if (!institute) {
    return <div className="p-8 text-center text-slate-500">Institute not found</div>;
  }

  const plan = institute.subscriptionPlan;
  const isVerifiedType =
    plan === "VERIFIED" ||
    (Boolean(institute.isVerified) && plan !== "PREMIUM" && plan !== "ULTRA");

  if (!isVerifiedType) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
          <KeyRound className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Contact Unlocks Not Applicable</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Your institute is on the <span className="font-semibold text-slate-900 capitalize">{plan.toLowerCase()}</span> plan. Because your contact details (phone, website, and social links) are already completely open and directly visible to all students across AcademyFind, contact unlocks only apply to Verified institutes.
        </p>
        <Link
          href={`/manager/${instituteId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors shadow-sm"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Where condition for this specific institute
  const whereCondition: any = {
    instituteId,
  };

  if (currentType !== "ALL") {
    whereCondition.unlockType = currentType;
  }

  if (searchQuery) {
    whereCondition.user = {
      OR: [
        { name: { contains: searchQuery, mode: "insensitive" } },
        { username: { contains: searchQuery, mode: "insensitive" } },
        { email: { contains: searchQuery, mode: "insensitive" } },
        { phone: { contains: searchQuery, mode: "insensitive" } },
      ],
    };
  }

  // Fetch unlock records & metric aggregations for this institute
  const [unlocks, totalCount, phoneCount, websiteCount, socialCount] =
    await Promise.all([
      prisma.instituteUnlock.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              phone: true,
              image: true,
            },
          },
        },
      }),
      prisma.instituteUnlock.count({ where: { instituteId } }),
      prisma.instituteUnlock.count({
        where: { instituteId, unlockType: "PHONE" },
      }),
      prisma.instituteUnlock.count({
        where: { instituteId, unlockType: "WEBSITE" },
      }),
      prisma.instituteUnlock.count({
        where: {
          instituteId,
          unlockType: { in: ["SOCIAL", "EMAIL", "COMMUNITY"] },
        },
      }),
    ]);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg shadow-amber-500/15">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-amber-100 text-xs font-bold mb-3 border border-white/20">
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            High Intent Student Leads
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Student Contact Unlocks
          </h1>
          <p className="text-amber-100 text-sm mt-2 leading-relaxed">
            These students spent their AFC Coins to reveal your phone number, website, or social profiles. They are actively searching for courses and coaching programs!
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Unlocks
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{totalCount}</p>
          <span className="text-xs text-slate-400 mt-1 block">Total student unlocks</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Phone Leads
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Phone className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-3">{phoneCount}</p>
          <span className="text-xs text-slate-400 mt-1 block">Revealed phone number</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Website Visits
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-3">{websiteCount}</p>
          <span className="text-xs text-slate-400 mt-1 block">Revealed official website</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Social / Features
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600 mt-3">{socialCount}</p>
          <span className="text-xs text-slate-400 mt-1 block">Social &amp; feature unlocks</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <form className="relative w-full md:w-80" method="GET">
          {currentType !== "ALL" && (
            <input type="hidden" name="type" value={currentType} />
          )}
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search student name or phone..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition"
          />
        </form>

        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {[
            { key: "ALL", label: "All" },
            { key: "PHONE", label: "Phone" },
            { key: "WEBSITE", label: "Website" },
            { key: "SOCIAL", label: "Social" },
            { key: "EMAIL", label: "Email" },
            { key: "COMMUNITY", label: "Features" },
          ].map((tab: any) => {
            const isActive = currentType === tab.key;
            const targetUrl = `?type=${tab.key}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`;
            return (
              <Link
                key={tab.key}
                href={targetUrl}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Leads List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {unlocks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 flex items-center justify-center text-amber-600 mb-4 border border-amber-100">
              <KeyRound className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No Student Unlocks Yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
              {searchQuery || currentType !== "ALL"
                ? "No unlocks match your current search or filter."
                : "When students on AcademyFind spend AFC Coins to unlock your phone number, website, or social handles, their full contact details will appear here!"}
            </p>
            {searchQuery || currentType !== "ALL" ? (
              <Link
                href={`/manager/${instituteId}/unlocks`}
                className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
              >
                Clear Filters
              </Link>
            ) : (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={`/manager/${instituteId}/profile`}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition shadow-xs"
                >
                  Enhance Institute Profile
                </Link>
                <Link
                  href={`/institute/${institute.slug || institute.id}`}
                  target="_blank"
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                >
                  View Public Profile ↗
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Student (Lead)</th>
                  <th className="py-3.5 px-6">Item Unlocked</th>
                  <th className="py-3.5 px-6">Unlocked At</th>
                  <th className="py-3.5 px-6 text-right">Connect Directly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {unlocks.map((u: any) => {
                  const badge = getUnlockTypeBadge(u.unlockType);
                  return (
                    <tr key={u.id} className="hover:bg-amber-50/20 transition-colors">
                      {/* Student Info */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 overflow-hidden">
                            {u.user.image ? (
                              <img
                                src={u.user.image}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (u.user.name || u.user.username || "U")[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">
                              {u.user.name || "Student"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {u.user.phone ? (
                                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-medium">
                                  {u.user.phone}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  No phone provided
                                </span>
                              )}
                              {u.user.email && (
                                <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                  {u.user.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Unlocked Item */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                        {u.description && (
                          <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[220px]">
                            {u.description}
                          </p>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                        {formatIST(u.createdAt)}
                      </td>

                      {/* Contact Buttons */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {u.user.phone && (
                            <a
                              href={`tel:${u.user.phone}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition border border-emerald-200"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call</span>
                            </a>
                          )}
                          {u.user.phone && (
                            <a
                              href={`https://wa.me/${u.user.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50 text-green-700 text-xs font-bold hover:bg-green-100 transition border border-green-200"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                          {u.user.email && (
                            <a
                              href={`mailto:${u.user.email}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition border border-blue-200"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Email</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
