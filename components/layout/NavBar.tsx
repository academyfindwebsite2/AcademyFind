"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import {
  Search,
  FileText,
  Building2,
  LogIn,
  UserPlus,
  Menu,
  Building,
  IdCard,
  Scale,
  MessageCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserDropdown from "@/components/navigation/UserDropdown";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { buildAuthHref } from "@/lib/auth/redirect-utils";

export default function Navbar({ session }: { session: any }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const loginHref = buildAuthHref("/login", pathname);
  const registerHref = buildAuthHref("/register", pathname);

  return (
    <header className="sticky top-0 z-[110] border-b border-slate-100 bg-white/80 backdrop-blur-md shadow-xs">
      {/* max-w ko thoda badhaya aur justify-between rakha taaki left, center, right me perfect distribution ho */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4 lg:px-10">

        {/* Left Area: Logo */}
        <div className="flex-1 flex justify-start">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md border border-slate-100 transition-all duration-300 group-hover:shadow-amber-500/25 group-hover:border-amber-200">
              <Image
                src="/logo.png"
                alt="AcademyFind Logo"
                width={26}
                height={26}
                className="object-contain transition-transform duration-300 group-hover:scale-110"
              />
            </div>

            <div>
              <span className="block text-lg font-extrabold tracking-tight text-slate-800 transition-colors group-hover:text-amber-500">
                AcademyFind
              </span>
              <p className="text-[0.6rem] font-bold tracking-widest text-amber-500 uppercase">
                Academy Search Simplified
              </p>
            </div>
          </Link>
        </div>

        {/* Center Area: Main Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 px-4">
          {[
            { label: "Search", href: "/" },
            { label: "About Us", href: "/about" },
            { label: "Careers", href: "/careers" },
            { label: "Articles", href: "/blog" },
            { label: "Contact", href: "/contact" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative py-1 text-sm font-semibold transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:scale-x-0 after:bg-amber-500 after:transition-transform after:duration-300 hover:text-amber-500 hover:after:scale-x-100 ${isActive(link.href) ? "text-amber-500 after:scale-x-100" : "text-slate-600"
                }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Area: Action Buttons & Auth Dropdown */}
        <div className="hidden lg:flex flex-1 justify-end items-center gap-4">
          <Link
            href="/compare"
            className={`group flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 whitespace-nowrap ${isActive("/compare")
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
              : "bg-amber-50 text-amber-700 border border-amber-100/50 hover:bg-amber-100 hover:text-amber-800"
              }`}
          >
            <Scale className="size-3.5 transition-transform duration-300 group-hover:rotate-12" />
            Compare Institutes
          </Link>

          <div className="relative group/add-inst">
            <Link
              href="/user/create-institute"
              className={`group flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 whitespace-nowrap ${isActive("/user/create-institute") || isActive("/?claim=true")
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                : "bg-amber-50 text-amber-700 border border-amber-100/50 hover:bg-amber-100 hover:text-amber-800"
                }`}
            >
              <Building className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
              Add Institute
            </Link>
            
            <div className="absolute top-full right-0 pt-2 w-64 opacity-0 invisible group-hover/add-inst:opacity-100 group-hover/add-inst:visible transition-all duration-200 z-[120]">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-2 flex flex-col gap-1">
                <Link href="/?claim=true" className="flex items-center gap-2 py-2.5 px-3 rounded-xl hover:bg-amber-50 hover:text-amber-700 text-slate-700 transition-colors">
                  <Search className="size-4" />
                  <span className="font-semibold text-sm">Claim your institute profile</span>
                </Link>
                <Link href="/user/create-institute" className="flex items-center gap-2 py-2.5 px-3 rounded-xl hover:bg-amber-50 hover:text-amber-700 text-slate-700 transition-colors">
                  <Building2 className="size-4" />
                  <span className="font-semibold text-sm">Add new institute profile</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Action Elements ke beech me cleaner spacing ke liye ek light divider */}
          <div className="h-5 w-px bg-slate-200/80 mx-1"></div>

          {/* Auth Dropdown / Buttons */}
          <div className="flex items-center gap-3">
            {session?.user ? (
              <>
                <NotificationBell />
                <Link
                  href="/chat"
                  title="Messages"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                >
                  <MessageCircle className="size-4" />
                </Link>
                <UserDropdown user={session.user} />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="gap-2 cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all duration-250">
                  <Link href={loginHref}>
                    <LogIn className="size-4" />
                    Login
                  </Link>
                </Button>

                <Button asChild className="gap-2 bg-amber-500 text-white shadow-xs hover:bg-amber-600 hover:shadow-md cursor-pointer rounded-xl border-0 transition-all duration-250 font-semibold px-4">
                  <Link href={registerHref}>
                    <UserPlus className="size-4" />
                    Sign Up
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Trigger */}
        <div className="lg:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-50">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[85vw] sm:w-80 max-w-sm z-[110] rounded-l-3xl p-6 border-slate-100 overflow-y-auto">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>

              <div className="flex items-center gap-3 border-b border-slate-100 pb-6 mb-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 shadow-xs">
                  <Image src="/logo.png" alt="AcademyFind Logo" width={22} height={22} />
                </div>
                <div>
                  <span className="block text-sm font-extrabold text-slate-800">AcademyFind</span>
                  <span className="block text-[8px] font-bold text-amber-500 uppercase tracking-widest">Search Simplified</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                {[
                  { label: "Search", href: "/", icon: Search },
                  { label: "About Us", href: "/about", icon: Building2 },
                  { label: "Careers", href: "/careers", icon: IdCard },
                  { label: "Articles", href: "/blog", icon: FileText },
                  { label: "Contact Us", href: "/contact", icon: Building2 },
                  { label: "Compare Institutes", href: "/compare", icon: Scale },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Button
                      key={item.href}
                      asChild
                      variant="ghost"
                      className={`justify-start gap-3 h-11 px-4 rounded-2xl transition-all duration-200 ${active
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-50 hover:text-amber-700 font-bold"
                        : "text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      <Link href={item.href} onClick={() => setIsOpen(false)}>
                        <Icon className={`size-4 ${active ? "text-amber-600" : "text-slate-400"}`} />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Add Institute</p>
                  
                  <Button
                    asChild
                    variant="ghost"
                    className={`justify-start gap-3 h-auto min-h-[2.75rem] py-2 px-4 rounded-2xl transition-all duration-200 whitespace-normal text-left ${isActive("/?claim=true")
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-50 hover:text-amber-700 font-bold"
                      : "text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <Link href="/?claim=true" onClick={() => setIsOpen(false)}>
                      <Search className={`size-4 shrink-0 ${isActive("/?claim=true") ? "text-amber-600" : "text-slate-400"}`} />
                      <span>Claim your institute profile</span>
                    </Link>
                  </Button>
                  
                  <Button
                    asChild
                    variant="ghost"
                    className={`justify-start gap-3 h-auto min-h-[2.75rem] py-2 px-4 rounded-2xl transition-all duration-200 whitespace-normal text-left ${isActive("/user/create-institute")
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-50 hover:text-amber-700 font-bold"
                      : "text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <Link href="/user/create-institute" onClick={() => setIsOpen(false)}>
                      <Building2 className={`size-4 shrink-0 ${isActive("/user/create-institute") ? "text-amber-600" : "text-slate-400"}`} />
                      <span>Add new institute profile</span>
                    </Link>
                  </Button>
                </div>

                <div className="my-4 border-t border-slate-100" />

                {session?.user ? (
                  <div className="px-2">
                    <UserDropdown user={session.user} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <Button asChild variant="outline" className="justify-start gap-3 h-11 px-4 rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200">
                      <Link href={loginHref}>
                        <LogIn className="size-4 text-slate-400" />
                        Login
                      </Link>
                    </Button>

                    <Button asChild className="gap-3 h-11 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-all duration-200 border-0">
                      <Link href={registerHref}>
                        <UserPlus className="size-4" />
                        Sign Up
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );

}