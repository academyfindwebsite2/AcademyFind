"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, LayoutDashboard, ChevronDown, PlusCircle, Building2, Briefcase, FileText, Bookmark, Wallet, MessageCircle, Settings, Megaphone, Coins, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function UserDropdown({ user }: { user: any }) {
  const router = useRouter();

  const [liveUserData, setLiveUserData] = useState({
    role: user?.role || "USER",
    canAddInstitute: user?.canAddInstitute || false,
    blogAuthorProfile: user?.blogAuthorProfile || null,
    walletBalance: 0,
    managedInstitute: null as any,
    hasIsmAssignment: false,
    pendingIsmInvites: [] as Array<{ id: string; institute?: { id: string; name: string } }>,
  });

  // 🚀 BACKGROUND FETCH: Background me chupke se fresh database records laao
  useEffect(() => {
    async function fetchFreshPermissions() {
      try {
        const res = await fetch("/api/user/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setLiveUserData({
              role: data.role,
              canAddInstitute: data.canAddInstitute,
              blogAuthorProfile: data.blogAuthorProfile || null,
              walletBalance: data.wallet?.balance || 0,
              managedInstitute: data.managedInstitutes?.[0]?.institute || null,
              hasIsmAssignment: (data.ismAssignments?.length ?? 0) > 0,
              pendingIsmInvites: data.ismInvitesReceived || [],
            });
          }
        }
      } catch (err) {
        console.error("Failed to sync dropdown with DB:", err);
      }
    }
    fetchFreshPermissions();
  }, []);

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <DropdownMenu>
      {/* Trigger Button */}
      <DropdownMenuTrigger className="flex items-center gap-2 outline-none rounded-full p-1 pr-2.5 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-amber-500">
        <div className="relative">
          <Avatar className="h-9 w-9 border border-slate-200 shadow-sm">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || "User"}
                width={64}
                height={64}
                className="rounded-full border h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-amber-100 font-semibold text-amber-700">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
          </Avatar>
          {liveUserData.pendingIsmInvites && liveUserData.pendingIsmInvites.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white shadow-xs"></span>
            </span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </DropdownMenuTrigger>

      {/* Dropdown Content */}
      <DropdownMenuContent
        className="w-64 mt-1 rounded-2xl p-2 shadow-xl shadow-slate-200/50 border-slate-100 z-120"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="font-normal p-2.5">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-bold text-slate-800 leading-none">{user?.name}</p>
            <p className="text-xs text-slate-500 mt-1 truncate">{user?.username ? `@${user.username}` : user?.email}</p>
            {liveUserData.walletBalance > 0 && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
                <Coins className="w-3.5 h-3.5 text-amber-500" /> {liveUserData.walletBalance.toLocaleString("en-IN")} coins
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        {/* 🚨 TEMPORARY TAB: Pending ISM Invite Request */}
        {liveUserData.pendingIsmInvites && liveUserData.pendingIsmInvites.length > 0 && (
          <>
            <div className="p-1 mb-1 space-y-1.5">
              {liveUserData.pendingIsmInvites.map((invite) => (
                <DropdownMenuItem
                  key={invite.id}
                  asChild
                  className="rounded-xl cursor-pointer py-2.5 px-3 bg-rose-50/90 hover:bg-rose-100/80 border border-rose-200/80 text-rose-950 focus:bg-rose-100 focus:text-rose-950 transition-colors"
                >
                  <Link href={`/ism-invite/${invite.id}`} className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0 p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs text-rose-950 truncate">ISM Invite</span>
                          <span className="bg-rose-200/80 text-rose-900 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            New
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-800/80 truncate font-medium">
                          {invite.institute?.name || "Institute"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 bg-white/90 px-2 py-0.5 rounded-md border border-rose-200/70 shrink-0 ml-2 shadow-2xs">
                      Review →
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator className="bg-slate-100 my-1" />
          </>
        )}

        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
          <Link href="/profile">
            <User className="mr-3 h-4 w-4" />
            <span className="font-medium text-sm">My Profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
          <Link href="/chat">
            <MessageCircle className="mr-3 h-4 w-4" />
            <span className="font-medium text-sm">Messages</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
          <Link href="/wallet">
            <Wallet className="mr-3 h-4 w-4" />
            <span className="font-medium text-sm">Wallet</span>
          </Link>
        </DropdownMenuItem>

        {false && <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
          <Link href="/user/advertisements">
            <Megaphone className="mr-3 h-4 w-4" />
            <span className="font-medium text-sm">My Advertisements</span>
          </Link>
        </DropdownMenuItem>}

        
        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
          <Link href="/support-tickets">
            <MessageCircle className="mr-3 h-4 w-4" />
            <span className="font-medium text-sm">Support Tickets</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-100 my-1" />

        <DropdownMenuLabel className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Blog
        </DropdownMenuLabel>

        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
          <Link href="/blog/write">
            <FileText className="mr-3 h-4 w-4" />
            <span className="font-medium text-sm">Write a Blog</span>
          </Link>
        </DropdownMenuItem>


        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
          <Link href="/blog/my-posts">
            <FileText className="mr-3 h-4 w-4" />
            <span className="font-medium text-sm">My Posts</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
          <Link href="/blog/bookmark">
            <Bookmark className="mr-3 h-4 w-4" />
            <span className="font-medium text-sm">Bookmarks</span>
          </Link>
        </DropdownMenuItem>

        {/* {liveUserData.blogAuthorProfile?.username ? (
          <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
            <Link href={`/blog/author/${liveUserData.blogAuthorProfile.username}`}>
              <User className="mr-3 h-4 w-4" />
              <span className="font-medium text-sm">Author Profile</span>
            </Link>
          </DropdownMenuItem>
        ) : null} */}

        <DropdownMenuSeparator className="bg-slate-100 my-1" />

        {/* 🚀 Profile Item - Wrapped inside Link with asChild to prevent navigation threads crash */}


        {/* Admin Dashboard */}
        {liveUserData?.role === 'ADMIN' && (
          <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
            <Link href="/af-ass-manage">
              <LayoutDashboard className="mr-3 h-4 w-4" />
              <span className="font-medium text-sm">Admin Panel</span>
            </Link>
          </DropdownMenuItem>
        )}


        {/* Manager Workspace */}
        {liveUserData?.role === 'SALES_MANAGER' && (
          <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
            <Link href="/sales_manager">
              <Briefcase className="mr-3 h-4 w-4" />
              <span className="font-medium text-sm">Sales dashboard</span>
            </Link>
          </DropdownMenuItem>
        )}

        {/* Institute Sales Manager Workspace */}
        {(liveUserData?.role === 'INSTITUTE_SALES_MANAGER' || liveUserData?.hasIsmAssignment) && (
          <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-violet-50 focus:text-violet-700 transition-colors">
            <Link href="/institute_sales">
              <GraduationCap className="mr-3 h-4 w-4 text-violet-600" />
              <span className="font-medium text-sm">Institute Sales</span>
            </Link>
          </DropdownMenuItem>
        )}

        {liveUserData.role === 'INSTITUTE_MANAGER' && (
          <DropdownMenuLabel className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Institute Manager
          </DropdownMenuLabel>
        )}
        {liveUserData?.role === 'INSTITUTE_MANAGER' && (
          <>
            <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
              <Link href="/manager">
                <LayoutDashboard className="mr-3 h-4 w-4" />
                <span className="font-medium text-sm">Manager Dashboard</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {/* 🚀 ADD LISTING PASS - Strictly rendering via native Boolean DB query passed from Server Navbar */}
        {/* {liveUserData?.canAddInstitute === true && (
          <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 focus:bg-emerald-100 focus:text-emerald-800 transition-colors">
            <Link href="/user/create-institute">
              <PlusCircle className="mr-3 h-4 w-4 text-emerald-600" />
              <span className="font-bold text-sm">Add Listing</span>
            </Link>
          </DropdownMenuItem>
        )} */}



        <DropdownMenuSeparator className="bg-slate-100 my-1" />

        {/* New routes: Chat, Wallet, Settings */}

        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-3 px-3 focus:bg-amber-50 focus:text-amber-700 transition-colors">
          <Link href="/settings/profile">
            <Settings className="mr-3 h-4 w-4" />
            <span className="font-medium text-sm">Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-100 my-1" />

        {/* Logout */}
        <DropdownMenuItem
          onClick={handleLogout}
          className="rounded-xl cursor-pointer py-3 px-3 text-red-600 focus:bg-red-50 focus:text-red-700 transition-colors"
        >
          <LogOut className="mr-3 h-4 w-4" />
          <span className="font-medium text-sm">Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}