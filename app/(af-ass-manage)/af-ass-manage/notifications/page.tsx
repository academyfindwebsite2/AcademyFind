import { prisma } from "@/lib/prisma";
import { Bell, CheckCircle, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { markAllAsRead } from "@/lib/User/admin/adminNotification";
import MarkAsReadButton from "@/components/admin/AdminMarkasRead";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatNotificationTime, formatNotificationRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic"; // Hamesha fresh data layega

export default async function AdminNotificationsPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    const userId = session?.user?.id;

    if (!session || !userId) {
        redirect("/login");
    }

    // 1. Database se sirf logged in admin ki notifications fetch karo (or general broadcast notifications)
    const notifications = await prisma.adminNotification.findMany({
        where: {
            OR: [
                { userId },
                { userId: null }
            ]
        },
        orderBy: { createdAt: "desc" },
        take: 50 // Sirf pichli 50 notifications dikhayenge
    });

    const unreadCount = notifications.filter((n: any) => !n.isRead).length;

    return (
        <div className="max-w-5xl mx-auto p-6 lg:p-10">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                        <Bell className="w-8 h-8 text-stone-500" /> 
                        Notifications
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2.5 py-1 rounded-full animate-pulse">
                                {unreadCount} New
                            </span>
                        )}
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Manage your platform alerts and callback requests here.
                    </p>
                </div>

                {unreadCount > 0 && (
                    <form action={markAllAsRead}>
                        <Button type="submit" variant="outline" className="border-slate-200 hover:bg-slate-50 font-bold text-slate-600">
                            <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                            Mark all as read
                        </Button>
                    </form>
                )}
            </div>

            {/* Notifications List */}
            {notifications.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
                    <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-700">All Caught Up!</h3>
                    <p className="text-slate-500 mt-1">You have no new notifications.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {notifications.map((notification: any) => (
                        <div 
                            key={notification.id} 
                            className={`flex flex-col sm:flex-row gap-4 justify-between sm:items-center p-5 rounded-2xl border transition-all ${
                                notification.isRead 
                                    ? "bg-white border-slate-200 opacity-70 hover:opacity-100" 
                                    : "bg-stone-50/50 border-stone-200 shadow-sm"
                            }`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Indicator Dot */}
                                <div className="mt-1.5 shrink-0">
                                    {notification.isRead ? (
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                    ) : (
                                        <div className="w-2.5 h-2.5 rounded-full bg-stone-500 animate-pulse" />
                                    )}
                                </div>
                                
                                <div>
                                    <h3 className={`font-bold ${notification.isRead ? "text-slate-700" : "text-slate-900"}`}>
                                        {notification.title}
                                    </h3>
                                    <p className="text-slate-600 mt-1 text-sm leading-relaxed">
                                        {notification.message}
                                    </p>
                                    <p className="text-slate-400 text-xs mt-2 flex items-center gap-1.5 font-medium">
                                        <Clock className="w-3.5 h-3.5 shrink-0" />
                                        <span>{formatNotificationRelativeTime(notification.createdAt)}</span>
                                        <span>•</span>
                                        <span>{formatNotificationTime(notification.createdAt)}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pl-6 sm:pl-0">
                                {!notification.isRead && (
                                    <MarkAsReadButton notificationId={notification.id} />
                                )}
                                
                                {/* {notification.actionUrl && (
                                    <Link href={notification.actionUrl}>
                                        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl">
                                            View Details <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </Link>
                                )} */}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}