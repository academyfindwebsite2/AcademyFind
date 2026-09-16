import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import Link from "next/link";
import { formatIST } from "@/lib/utils";
import {
  KeyRound,
  Phone,
  Globe,
  Mail,
  Share2,
  Sparkles,
  Building2,
  User,
  Search,
  ExternalLink,
  Coins,
  ArrowUpRight,
  MessageCircle,
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

export default async function AdminUnlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const currentType = params.type || "ALL";
  const searchQuery = params.q?.trim() || "";

  // Build filter conditions
  const whereCondition: Prisma.InstituteUnlockWhereInput = {};

  if (currentType !== "ALL") {
    whereCondition.unlockType = currentType;
  }

  if (searchQuery) {
    whereCondition.OR = [
      { user: { name: { contains: searchQuery, mode: "insensitive" } } },
      { user: { username: { contains: searchQuery, mode: "insensitive" } } },
      { user: { email: { contains: searchQuery, mode: "insensitive" } } },
      { user: { phone: { contains: searchQuery, mode: "insensitive" } } },
      { institute: { name: { contains: searchQuery, mode: "insensitive" } } },
    ];
  }

  // Fetch unlock records & metric aggregations
  const [unlocks, totalCount, phoneCount, websiteCount, socialCount, coinsSum] =
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
          institute: {
            select: {
              id: true,
              name: true,
              slug: true,
              phone: true,
              email: true,
              website: true,
              city: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.instituteUnlock.count(),
      prisma.instituteUnlock.count({ where: { unlockType: "PHONE" } }),
      prisma.instituteUnlock.count({ where: { unlockType: "WEBSITE" } }),
      prisma.instituteUnlock.count({
        where: { unlockType: { in: ["SOCIAL", "EMAIL", "COMMUNITY"] } },
      }),
      prisma.instituteUnlock.aggregate({
        _sum: { coinsSpent: true },
      }),
    ]);

  const totalCoinsSpent = coinsSum._sum.coinsSpent || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold mb-2">
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            Lead Generation Analytics
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Institute Contact Unlocks
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time feed of students spending AFC Coins to unlock institute contact details.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          <span className="text-xs text-slate-400 mt-1 block">Lifetime lead unlocks</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Phone Unlocks
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Phone className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{phoneCount}</p>
          <span className="text-xs text-slate-400 mt-1 block">Direct calling leads</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Website Clicks
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{websiteCount}</p>
          <span className="text-xs text-slate-400 mt-1 block">Direct web traffic</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Social / Email
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{socialCount}</p>
          <span className="text-xs text-slate-400 mt-1 block">Social &amp; feature unlocks</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Coins Burned
            </span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-3">{totalCoinsSpent}</p>
          <span className="text-xs text-slate-400 mt-1 block">Total AFC spent</span>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <form className="relative w-full md:w-96" method="GET">
          {currentType !== "ALL" && (
            <input type="hidden" name="type" value={currentType} />
          )}
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search student or institute..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition"
          />
        </form>

        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {[
            { key: "ALL", label: "All Types" },
            { key: "PHONE", label: "Phone" },
            { key: "WEBSITE", label: "Website" },
            { key: "EMAIL", label: "Email" },
            { key: "SOCIAL", label: "Social" },
            { key: "COMMUNITY", label: "Community" },
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

      {/* Unlocks Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {unlocks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
              <KeyRound className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Contact Unlocks Found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery || currentType !== "ALL"
                ? "Try clearing filters or search terms to see all unlocks."
                : "When students unlock contact details or features of coaching institutes, they will appear here."}
            </p>
            {(searchQuery || currentType !== "ALL") && (
              <Link
                href="/af-ass-manage/unlocks"
                className="mt-4 inline-block px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
              >
                Reset Filters
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Student (Lead)</th>
                  <th className="py-3.5 px-6">Target Institute</th>
                  <th className="py-3.5 px-6">Unlocked Item</th>
                  <th className="py-3.5 px-6">Coins Spent</th>
                  <th className="py-3.5 px-6">Date &amp; Time</th>
                  <th className="py-3.5 px-6 text-right">Direct Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {unlocks.map((u: any) => {
                  const badge = getUnlockTypeBadge(u.unlockType);
                  return (
                    <tr key={u.id} className="hover:bg-amber-50/20 transition-colors">
                      {/* Student Details */}
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
                            <p className="text-xs text-slate-500 mt-0.5">
                              @{u.user.username || "user"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {u.user.phone && (
                                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-medium">
                                  {u.user.phone}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500 truncate max-w-[160px]">
                                {u.user.email}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Institute Details */}
                      <td className="py-4 px-6">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <Link
                              href={`/institute/${u.institute.slug || u.institute.id}`}
                              target="_blank"
                              className="font-bold text-slate-900 hover:text-amber-600 transition flex items-center gap-1 group"
                            >
                              <span>{u.institute.name}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-amber-600" />
                            </Link>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            📍 {u.institute.city?.name || "All India"}
                          </p>
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
                          <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[200px]">
                            {u.description}
                          </p>
                        )}
                      </td>

                      {/* Coins Spent */}
                      <td className="py-4 px-6">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
                          <Coins className="w-3.5 h-3.5 text-amber-600" />
                          <span>{u.coinsSpent} AFC</span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                        {formatIST(u.createdAt)}
                      </td>

                      {/* Action Links */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.user.phone && (
                            <a
                              href={`tel:${u.user.phone}`}
                              title="Call Student"
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          {u.user.phone && (
                            <a
                              href={`https://wa.me/${u.user.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="WhatsApp Student"
                              className="p-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          {u.user.email && (
                            <a
                              href={`mailto:${u.user.email}`}
                              title="Email Student"
                              className="p-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                            >
                              <Mail className="w-4 h-4" />
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
