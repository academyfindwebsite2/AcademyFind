import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import {
  Star, Phone, MapPin, Mail, Globe, CheckCircle, Users, Trophy,
  PlayCircle, User, Presentation, BookOpen, IndianRupee, Clock,
  Home, Award, Calendar, Building, ThumbsUp, ThumbsDown, HelpCircle, Check,
  BadgeCheck, MessageCircle, ArrowRight, Settings, Lock, Unlock,
  GraduationCap, UserCheck
} from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin, FaTelegram, FaTwitter, FaWhatsapp, FaYoutube } from "react-icons/fa";

import extractId from "@/lib/extractId";
import { getInstituteById } from "@/lib/institutes/institutes_id";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/auth";
import { trackVisitHistory } from "@/lib/User/user/user-activity";

import Breadcrumb from "@/components/navigation/BreadCrumbs";
import InstituteMap from "@/components/maps/InstituteMap";
import ReviewForm from "@/components/reviews/ReviewForm";
import { Button } from "@/components/ui/button";
import SaveButton from "@/components/ui/SaveButton";
import InstituteEnquiryForm from "@/components/manager/InstituteEnquiryForm";
import ViewTracker from "@/components/manager/ViewTracker";
import { getCachedInstituteById } from "@/lib/cachedQueries";
import { LockedOverlay } from "@/components/institutes/LockedOverlay";
import { JoinActionBar } from "@/app/(public)/institute/[idSlug]/JoinActionBar";
import { MemberDrawer } from "./components/MemberDrawer";
import BlogCard from "@/components/blog/cards/BlogCard";
import { BlogCardPost } from "@/types/BlogCard";
import { OpenBatchChatButton } from "@/components/manager/OpenBatchChatButton";
import { InteractiveGallery } from "@/components/ui/interactive-gallery";
import { ReviewItem } from "@/components/reviews/ReviewItem";
import { UnlockContactButton } from "@/components/institutes/UnlockContactButton";
import { UnlockBasicFeaturesOverlay } from "@/components/institutes/UnlockBasicFeaturesOverlay";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ idSlug: string }>;
}

// 🚀 Helper Functions
function isCloudinaryImage(url?: string | null) {
  if (!url) return false;
  return url.includes("cloudinary.com");
}

const getFallbackImage = () => {
  return "/no_image/coaching_inst.PNG";
};

function getSafeImageUrl(logo?: string | null, imageUrl?: string | null) {
  if (isCloudinaryImage(logo)) return logo!;
  if (isCloudinaryImage(imageUrl)) return imageUrl!;
  return getFallbackImage();
}

function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const formatCurrency = (amount?: number | null) => {
  if (!amount) return "N/A";
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

// ─── 1. METADATA ─────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { idSlug } = await params;
  const id = extractId(idSlug);
  const institute = await getInstituteById(id);

  if (!institute) return { title: "Institute Not Found | AcademyFind" };

  const currentYear = new Date().getFullYear();
  const title = institute.metaTitle || `${institute.name} ${institute.city.name} - Fees, Reviews, Admission & Contact ${currentYear}`;
  const description = institute.metaDescription || institute.description?.substring(0, 155) || `Get complete details about ${institute.name} in ${institute.city.name}. Check ${currentYear} fee structure, read genuine student reviews, and get admission guidance. ⚡ Click to learn more.`;

  const safeOgImage = getSafeImageUrl(institute.logo, institute.imageUrl);

  const baseUrl = institute.providerType === 'INDIVIDUAL' ? '/educator' : '/institute';

  let keywordArray = [
    `${institute.name} ${institute.city.name}`,
    `${institute.name} fees`,
    `${institute.name} reviews`,
    `${institute.name} admission`,
    `best coaching in ${institute.city.name}`,
    `${institute.categories[0]?.category.name} in ${institute.city.name}`
  ];

  if (institute.metaKeywords) {
    const customKeywords = institute.metaKeywords.split(',').map(k => k.trim()).filter(Boolean);
    keywordArray = [...customKeywords, ...keywordArray];
  }

  return {
    title,
    description,
    alternates: { canonical: `https://academyfind.com${baseUrl}/${idSlug}` },
    keywords: keywordArray,
    openGraph: {
      title,
      description,
      images: [safeOgImage],
      type: 'website',
    }
  };
}

// ─── 2. PAGE COMPONENT ───────────────────────────────────────
export default async function InstitutePage({ params }: PageProps) {
  const { idSlug } = await params;
  const id = extractId(idSlug);

  if (id === "cmqqige1706majgifuypl92mg") {
    notFound();
  }

  const institute = await getCachedInstituteById(id);

  if (!institute) notFound();

  // Session for join bar
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;

  let userDetails = null;
  if (userId) {
    userDetails = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true, email: true },
    });
  }

  // Current user's memberships at this institute
  const [
    userMemberships,
    presentStudents,
    featuredFaculty,
    totalStudents,
    totalTeachers,
    activeBatches,
    instituteManagers,
    recentBlogs,
    userBatchIds,
  ] = await Promise.all([
    userId
      ? prisma.instituteMembership.findMany({
        where: { userId, instituteId: id },
        select: { id: true, role: true, status: true },
      })
      : Promise.resolve([]),
    prisma.studentInstituteRecord.findMany({
      where: { instituteId: id, isVerified: true, isVisible: true, membership: { status: "ACTIVE" } },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        courseName: true,
        batchYear: true,
        bio: true,
        studentProfile: {
          select: {
            user: { select: { id: true, name: true, username: true, image: true, allowDms: true, chatSettings: { select: { allowDirectMessages: true } } } },
          },
        },
      },
    }),
    prisma.teacherInstituteRecord.findMany({
      where: { instituteId: id, isVerified: true, isVisible: true, membership: { status: "ACTIVE" } },
      orderBy: [{ isFeatured: "desc" }, { displayOrder: "asc" }],
      take: 6,
      select: {
        id: true,
        designation: true,
        teachingSubjects: true,
        isFeatured: true,
        bio: true,
        teacherProfile: {
          select: {
            user: { select: { id: true, name: true, username: true, image: true, allowDms: true, chatSettings: { select: { allowDirectMessages: true } } } },
          },
        },
      },
    }),
    prisma.studentInstituteRecord.count({
      where: { instituteId: id, isVerified: true, isVisible: true, membership: { status: "ACTIVE" } }
    }),
    prisma.teacherInstituteRecord.count({
      where: { instituteId: id, isVerified: true, isVisible: true, membership: { status: "ACTIVE" } }
    }),
    prisma.instituteBatch.findMany({
      where: { instituteId: id, isActive: true },
      include: {
        _count: { select: { studentMembers: true } },
        teacherMembers: {
          include: {
            teacherRecord: {
              include: {
                teacherProfile: {
                  include: { user: { select: { image: true, name: true } } }
                }
              }
            }
          }
        }
      }
    }),
    prisma.instituteManager.findMany({
      where: { instituteId: id },
      include: {
        user: {
          select: { id: true, name: true, username: true, image: true, allowDms: true, chatSettings: { select: { allowDirectMessages: true } } }
        }
      }
    }),
    prisma.blogPost.findMany({
      where: { relatedInstituteId: id, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        coverImageAlt: true,
        readingTime: true,
        publishedAt: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        authorProfile: {
          select: {
            displayName: true,
            user: { select: { username: true } },
            avatarUrl: true,
            isVerified: true,
          }
        },
        category: {
          select: { id: true, name: true, slug: true }
        },
        brand: {
          select: { id: true, name: true, slug: true, avatarUrl: true }
        }
      }
    }),
    userId
      ? Promise.all([
        prisma.batchStudent.findMany({
          where: { studentRecord: { studentProfile: { userId }, instituteId: id } },
          select: { batchId: true }
        }),
        prisma.batchTeacher.findMany({
          where: { teacherRecord: { teacherProfile: { userId }, instituteId: id } },
          select: { batchId: true }
        })
      ]).then(([students, teachers]) => {
        return new Set([...students.map((s: any) => s.batchId), ...teachers.map((t: any) => t.batchId)]);
      })
      : Promise.resolve(new Set<string>())
  ]);

  const formattedBlogs: BlogCardPost[] = recentBlogs.map((blog: any) => ({
    ...blog,
    authorProfile: blog.authorProfile ? {
      displayName: blog.authorProfile.displayName,
      username: blog.authorProfile.user.username,
      avatarUrl: blog.authorProfile.avatarUrl,
      isVerified: blog.authorProfile.isVerified,
    } : null,
  }));

  // Derive membership states per role
  const studentMembership = userMemberships.find((m: any) => m.role === "STUDENT") ?? null;
  const teacherMembership = userMemberships.find((m: any) => m.role === "TEACHER") ?? null;
  const isOwner = instituteManagers.some((m: any) => m.user.id === userId);

  // Check if current user has already unlocked this institute's contacts with AFC coins
  let hasUnlockedBasicFeatures = false;
  let hasUnlockedCommunity = false;

  if (userId) {
    const contactUnlockTx = await prisma.walletTransaction.findFirst({
      where: {
        wallet: { userId },
        source: "SEE_CONTACT_BASIC_INSTITUTE",
        referenceId: id,
        type: "DEBIT"
      }
    });
    if (contactUnlockTx) hasUnlockedBasicFeatures = true;

    const communityUnlockTx = await prisma.walletTransaction.findFirst({
      where: {
        wallet: { userId },
        source: "SEE_COMMUNITY_BASIC_INSTITUTE",
        referenceId: id,
        type: "DEBIT"
      }
    });
    if (communityUnlockTx) hasUnlockedCommunity = true;
  }

  // Lock contact details for basic & verified plan institutes (unless already unlocked by user)
  const isContactLocked = (institute.subscriptionPlan === "BASIC" || institute.subscriptionPlan === "VERIFIED") && !hasUnlockedBasicFeatures;
  const isCommunityLocked = (institute.subscriptionPlan === "BASIC" || institute.subscriptionPlan === "VERIFIED") && !hasUnlockedCommunity;

  const isManager = instituteManagers.some((m: any) => m.user.id === userId);
  const isMember = userMemberships.some((m: any) => m.status === "ACTIVE") || isManager || session?.user?.role === "ADMIN";

  const displayRating = institute.googleRating ?? institute.averageRating ?? 0;
  const displayReviewCount = institute.googleReviewCount ?? institute.reviewCount ?? 0;
  const isAlreadyClaimed = institute.managers && institute.managers.length > 0;
  const plan = institute.subscriptionPlan || "BASIC";

  const hasVerifiedAccess = ["PREMIUM", "ULTRA", "VERIFIED"].includes(plan);
  const hasUltraAccess = ["ULTRA", "PREMIUM"].includes(plan);

  // Similar Institutes
  let similarInstitutes: any[] = [];
  if (institute.categories[0]?.categoryId && institute.cityId) {
    similarInstitutes = await prisma.institute.findMany({
      where: { cityId: institute.cityId, isActive: true, id: { not: institute.id }, categories: { some: { categoryId: institute.categories[0].categoryId } } },
      take: 3,
      orderBy: { averageRating: 'desc' },
      include: { city: true, categories: { include: { category: true } } }
    });
  }

  const safeSchemaImage = getSafeImageUrl(institute.logo, institute.imageUrl);
  const mainLogo = safeSchemaImage.replace("https://academyfind.com", "");

  const safeMapsUrl = institute.googleMapsUrl && !institute.googleMapsUrl.includes("key=")
    ? institute.googleMapsUrl
    : `https://www.google.com/maps/search/?api=1&query=$?q=${encodeURIComponent(`${institute.name}, ${institute.address || institute.city.name}`)}`;

  // Extract top reviews for schema
  const reviewsSchema = institute.reviews?.slice(0, 5).map((rev: any) => ({
    "@type": "Review",
    "author": {
      "@type": "Person",
      "name": rev.user?.name || "Student"
    },
    "datePublished": rev.createdAt,
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": rev.rating,
      "bestRating": "5"
    },
    "reviewBody": rev.content || ""
  })) || [];

  // ── 3. JSON-LD ──
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "EducationalOrganization"],
    "name": institute.name,
    "image": safeSchemaImage,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": institute.address || "",
      "addressLocality": institute.city.name,
      "addressCountry": "IN"
    },
    "telephone": institute.phone || "",
    "url": institute.website || `https://academyfind.com/institute/${idSlug}`,
    "priceRange": "₹₹",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": displayRating > 0 ? displayRating : 4.8,
      "reviewCount": displayReviewCount > 0 ? displayReviewCount : 12
    },
    ...(reviewsSchema.length > 0 && { "review": reviewsSchema })
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": institute.categories[0]?.category.name || "Institute",
        "item": `https://academyfind.com/${institute.categories[0]?.category.slug}`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": institute.city.name,
        "item": `https://academyfind.com/${institute.categories[0]?.category.slug}/${institute.city.slug}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": institute.name,
        "item": `https://academyfind.com/institute/${idSlug}`
      }
    ]
  };

  let faqSchema: any = null;
  if (institute.faqs && institute.faqs.length > 0) {
    faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": institute.faqs.map((faq: any) => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };
  }

  const jsonLdArray: any[] = [localBusinessSchema, breadcrumbSchema];
  if (faqSchema) jsonLdArray.push(faqSchema);

  const validClassroomImages = institute.classroomImages?.filter(isCloudinaryImage) || [];
  const validGalleryImages = institute.gallery?.filter(isCloudinaryImage) || [];

  return (
    <main className="min-h-screen bg-slate-50">
      <Script
        id="schema-institute"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArray) }}
      />
      <ViewTracker instituteId={institute.id} />

      <section className="relative w-full bg-slate-50 pb-10">
        {/* Immersive Cover Banner */}
        {institute.coverImage ? (
          <div className="absolute top-0 left-0 w-full h-[380px] md:h-[450px] z-0 overflow-hidden">
            <Image
              src={institute.coverImage}
              alt={`${institute.name} Cover`}
              fill
              className="object-cover"
              priority
            />
            {/* Smooth gradient fade into the background */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/40 to-slate-50" />
          </div>
        ) : (
          <div className="absolute top-0 left-0 w-full h-[380px] md:h-[450px] z-0 overflow-hidden bg-slate-900">
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
            <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-amber-500/20 blur-[100px] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-slate-50" />
          </div>
        )}

        {/* Content Container */}
        <div className="mx-auto max-w-7xl px-4 relative z-10 pt-8 md:pt-12">
          {/* Breadcrumbs (Light text for dark background) */}
          <div className="mb-8 drop-shadow-md brightness-0 invert opacity-90">
            <Breadcrumb
              items={[
                { label: institute.categories[0]?.category.name || "Institute", href: `/${institute.categories[0]?.category.slug}` },
                { label: institute.city.name, href: `/${institute.categories[0]?.category.slug}/${institute.city.slug}` },
                { label: institute.name, href: "#" },
              ]}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
            {/* Left Column - Main Profile Card */}
            <div className="space-y-8">
              {/* Profile Card */}
              <div className="rounded-[2.5rem] bg-white/95 backdrop-blur-xl p-6 md:p-10 shadow-2xl shadow-slate-200/50 border border-white relative mt-10 md:mt-16">

                {/* Floating Logo */}
                <div className="absolute -top-16 md:-top-20 left-6 md:left-10 h-32 w-32 md:h-40 md:w-40 flex items-center justify-center overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border-4 border-white shadow-xl bg-white">
                  <Image src={mainLogo} alt={institute.name} width={160} height={160} className="h-full w-full object-contain object-center" />
                </div>

                <div className="mt-16 md:mt-20">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                          {institute.name}
                          <span className="block text-lg font-medium text-slate-500 mt-1">
                            Best {institute.categories[0]?.category.name} in {institute.city.name}
                          </span>
                        </h1>
                        {institute.isVerified && (
                          <p className="text-[0.65rem] font-bold text-blue-600 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 mt-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Verified
                          </p>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-3">
                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                          {/* Mode Badge */}
                          {institute.mode && (
                            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 tracking-wide uppercase whitespace-nowrap">
                              {institute.mode}
                            </span>
                          )}
                          {institute.categories.map((item: any) => (
                            <span key={item.category.id} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 tracking-wide uppercase whitespace-nowrap">
                              {item.category.name}
                            </span>
                          ))}
                        </div>
                        {displayRating > 0 && institute.googlePlaceId && (
                          <Link
                            href={`${process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL}${institute.googlePlaceId}`}
                            prefetch={false}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                          >
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                            <span>
                              {displayRating} ({displayReviewCount} Reviews)
                            </span>
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 relative z-20 flex items-center gap-2">
                      {(institute.subscriptionPlan === "BASIC" || institute.subscriptionPlan === "VERIFIED") ? (
                        <div 
                          className="inline-flex h-9 sm:h-10 items-center justify-center rounded-xl bg-amber-50 px-2.5 sm:px-4 text-xs sm:text-sm font-bold text-amber-700 border border-amber-200 gap-1.5 cursor-not-allowed shadow-2xs" 
                          title="Forum locked (Available on Premium/Ultra)"
                        >
                          <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
                          <span>Forum Locked</span>
                        </div>
                      ) : isMember ? (
                        <Link 
                          href={`/chat?instituteId=${institute.id}`} 
                          className="inline-flex h-9 sm:h-10 items-center justify-center rounded-xl bg-blue-50 px-2.5 sm:px-4 text-xs sm:text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100 border border-blue-200 gap-1.5 shadow-2xs"
                        >
                          <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                          <span>Institute Forum</span>
                        </Link>
                      ) : (
                        <div 
                          className="inline-flex h-9 sm:h-10 items-center justify-center rounded-xl bg-blue-50/70 px-2.5 sm:px-4 text-xs sm:text-sm font-bold text-blue-600 border border-blue-200/60 gap-1.5 cursor-pointer" 
                          title="Join institute as student or teacher to access forum"
                        >
                          <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                          <span>Forum</span>
                        </div>
                      )}
                      {isManager && (
                        <Link href={`/manager/${institute.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 border border-slate-200">
                          <Settings className="h-5 w-5" />
                        </Link>
                      )}
                      {session?.user?.role === "ADMIN" && (
                        <Link href={`/af-ass-manage/institutes/${institute.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-700 transition-colors hover:bg-rose-200 border border-rose-200" title="Admin View">
                          <Settings className="h-5 w-5" />
                        </Link>
                      )}
                      <SaveButton instituteId={institute.id} />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100 text-left">
                    <Link href={safeMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2.5 text-slate-600 hover:text-amber-600 transition group">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 group-hover:scale-110 transition-transform" />
                      <span className="text-sm leading-relaxed underline-offset-4 group-hover:underline">{institute.address || institute.city.name}</span>
                    </Link>
                    {isContactLocked ? (
                      <div className="flex flex-col gap-3 pt-3 border-t border-slate-200/60 mt-1">
                        <div className="flex flex-col sm:flex-row gap-4">
                          {institute.phone && (
                            <UnlockContactButton type="phone" hiddenValue="+91 98XXX XX123" realValue={institute.phone} isLoggedIn={!!userId} instituteId={institute.id} />
                          )}
                          {institute.email && (
                            <UnlockContactButton type="email" hiddenValue="contact@hidden.com" realValue={institute.email} isLoggedIn={!!userId} instituteId={institute.id} />
                          )}
                          {institute.website && (
                            <UnlockContactButton type="website" hiddenValue="Visit Website" realValue={institute.website} isLoggedIn={!!userId} instituteId={institute.id} />
                          )}
                        </div>
                        <UnlockContactButton
                          type="social"
                          hiddenValue="Social Media"
                          socialUrls={{
                            instagram: institute.instagramUrl,
                            facebook: institute.facebookUrl,
                            youtube: institute.youtubeUrl,
                            linkedin: institute.linkedinUrl,
                            twitter: institute.twitterUrl,
                            whatsapp: institute.whatsappUrl,
                            telegram: institute.telegramUrl,
                          }}
                          isLoggedIn={!!userId}
                          instituteId={institute.id}
                          instituteName={institute.name}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 pt-2 border-t border-slate-200/60 mt-1">
                          {hasUnlockedBasicFeatures && institute.subscriptionPlan === "BASIC" && (
                            <div className="w-full flex items-center mb-1">
                              <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border border-emerald-200">
                                <Unlock className="w-3 h-3" /> Unlocked (1 AFC)
                              </span>
                            </div>
                          )}
                          {institute.phone && <a href={`tel:${institute.phone}`} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-amber-600"><Phone className="h-4 w-4 text-amber-500" /> {institute.phone}</a>}
                          {institute.email && <a href={`mailto:${institute.email}`} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-amber-600"><Mail className="h-4 w-4 text-amber-500" /> {institute.email}</a>}
                          {institute.website && <a href={institute.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-amber-600"><Globe className="h-4 w-4 text-amber-500" /> Visit Website</a>}
                        </div>

                        {/* Social Media Section */}
                        {(institute.facebookUrl || institute.instagramUrl || institute.twitterUrl || institute.youtubeUrl || institute.telegramUrl || institute.whatsappUrl) && (
                          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200/60 mt-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">Follow:</span>
                            {institute.whatsappUrl && <a href={institute.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:scale-110 transition-transform"><FaWhatsapp className="h-5 w-5" /></a>}
                            {institute.instagramUrl && <a href={institute.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:scale-110 transition-transform"><FaInstagram className="h-5 w-5" /></a>}
                            {institute.facebookUrl && <a href={institute.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:scale-110 transition-transform"><FaFacebook className="h-5 w-5" /></a>}
                            {institute.youtubeUrl && <a href={institute.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:scale-110 transition-transform"><FaYoutube className="h-5 w-5" /></a>}
                            {institute.linkedinUrl && <a href={institute.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:scale-110 transition-transform"><FaLinkedin className="h-5 w-5" /></a>}
                            {institute.twitterUrl && <a href={institute.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:scale-110 transition-transform"><FaTwitter className="h-5 w-5" /></a>}
                            {institute.telegramUrl && <a href={institute.telegramUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:scale-110 transition-transform"><FaTelegram className="h-5 w-5" /></a>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Quick Amenities Toggles */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {institute.hasOnlineClasses && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-green-700 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Online Classes</span>}
                  {institute.hasHostelFacility && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-green-700 text-xs font-bold"><Home className="w-3.5 h-3.5" /> Hostel Available</span>}
                  {institute.hasDemoClasses && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-green-700 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Demo Classes</span>}
                  {institute.hasScholarship && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-green-700 text-xs font-bold"><Award className="w-3.5 h-3.5" /> Scholarships</span>}
                  {institute.hasCertification && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-green-700 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Certification</span>}
                </div>

                {/* About Section (Dynamic SEO) */}
                <div className="mt-6 p-5 md:p-6 bg-gradient-to-br from-amber-50/50 to-amber-100/30 border border-amber-100/80 rounded-3xl text-sm md:text-base space-y-4 shadow-sm">
                  <p className="leading-relaxed text-amber-950 font-medium">
                    Looking for the best {institute.categories[0]?.category.name || "Coaching"} in {institute.city.name}? <strong className="text-slate-900 font-bold">{institute.name}</strong> is a top-rated choice, known for its excellent results. {displayRating > 0 ? `With a rating of ${displayRating} stars from ${displayReviewCount} students, they` : "They"} offer comprehensive programs tailored to help students succeed.
                  </p>
                  {institute.description && (
                    <p className="leading-relaxed text-amber-900/90 pt-3 border-t border-amber-200/50">
                      {institute.description}
                    </p>
                  )}
                </div>

                {!isAlreadyClaimed && (
                  <div className="mt-5 p-5 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-amber-900 font-bold flex items-center gap-1.5 text-sm md:text-base">
                        <CheckCircle className="w-4 h-4 text-amber-500" /> Are you the owner or representative?
                      </p>
                      <p className="text-amber-700 text-xs md:text-sm leading-relaxed">
                        Don't miss out on student leads! Claim your profile now to manage enquiries, update details, and get real-time insights on who visits or saves your page.
                      </p>
                      {false && <div className="inline-flex bg-amber-200/50 text-amber-900 px-3 py-1 rounded-md text-xs font-bold items-center gap-1.5 mt-1 border border-amber-200">
                        🎉 Early Bird Offer: Free/Discounted pricing valid only till 15th August!
                      </div>}
                    </div>

                    <div className="shrink-0 w-full sm:w-auto flex flex-col gap-3">
                      <Link href={`/institute/${institute.id}-${institute.slug}/claim`} className="w-full">
                        <Button className="bg-amber-600 hover:bg-amber-700 text-white transition-colors px-6 font-bold w-full rounded-xl cursor-pointer">
                          Claim Profile
                        </Button>
                      </Link>
                      <p className="text-center text-[11px] text-amber-700/80 font-medium">
                        Want to remove this listing? <Link href="/contact" className="underline underline-offset-2 hover:text-amber-900 transition-colors">Contact us</Link>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky CTA */}
            <div>
              <InstituteEnquiryForm
                instituteId={institute.id}
                feeInfo={institute.feeInfo}
                mapsUrl={safeMapsUrl}
                isLoggedIn={!!userId}
                instituteName={institute.name}
                defaultName={userDetails?.name}
                defaultPhone={userDetails?.phone}
                defaultEmail={userDetails?.email}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── JOIN ACTION BAR ── */}
      <JoinActionBar
        instituteId={institute.id}
        instituteName={institute.name}
        isLoggedIn={!!userId}
        studentStatus={studentMembership?.status as any ?? null}
        studentMembershipId={studentMembership?.id ?? null}
        teacherStatus={teacherMembership?.status as any ?? null}
        teacherMembershipId={teacherMembership?.id ?? null}
      />

      {/* ── STICKY TABLE OF CONTENTS (SITELINKS SEO) ── */}
      <div className="sticky top-[72px] z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/60 shadow-sm hidden md:block">
        <div className="mx-auto max-w-7xl px-4 overflow-x-auto no-scrollbar py-3">
          <ul className="flex items-center space-x-8 text-sm font-bold text-slate-600 whitespace-nowrap">
            <li><a href="#overview" className="hover:text-amber-600 transition-colors">Overview</a></li>
            <li><a href="#courses" className="hover:text-amber-600 transition-colors">Courses & Fees</a></li>
            <li><a href="#community" className="hover:text-amber-600 transition-colors">Community</a></li>
            <li><a href="#gallery" className="hover:text-amber-600 transition-colors">Gallery</a></li>
            <li><a href="#faqs" className="hover:text-amber-600 transition-colors">FAQs</a></li>
            <li><a href="#reviews" className="hover:text-amber-600 transition-colors">Reviews</a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 space-y-16 relative z-10">

        {/* 🚀 QUICK FACTS & STATS */}
        <section id="overview" className="scroll-mt-32">
          <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border bg-white p-5 shadow-sm flex flex-col justify-center items-center text-center">
              <Calendar className="w-6 h-6 text-amber-500 mb-2" />
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Established</p>
              <h3 className="mt-1 text-lg font-extrabold text-slate-800">{institute.establishedYear || "N/A"}</h3>
            </div>
            <div className="rounded-3xl border bg-white p-5 shadow-sm flex flex-col justify-center items-center text-center">
              <Users className="w-6 h-6 text-blue-500 mb-2" />
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Students</p>
              <h3 className="mt-1 text-lg font-extrabold text-slate-800">{institute.totalStudents ? `${institute.totalStudents}+` : "N/A"}</h3>
            </div>
            <div className="rounded-3xl border bg-white p-5 shadow-sm flex flex-col justify-center items-center text-center">
              <Building className="w-6 h-6 text-purple-500 mb-2" />
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Branches</p>
              <h3 className="mt-1 text-lg font-extrabold text-slate-800">{institute.totalBranches || 1}</h3>
            </div>
            <div className="rounded-3xl border bg-white p-5 shadow-sm flex flex-col justify-center items-center text-center">
              <IndianRupee className="w-6 h-6 text-emerald-500 mb-2" />
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Estimated Fees</p>
              <h3 className="mt-1 text-lg font-extrabold text-slate-800">
                {institute.feeMin || institute.feeMax
                  ? `${formatCurrency(institute.feeMin)} - ${formatCurrency(institute.feeMax)}`
                  : "On Request"}
              </h3>
            </div>
          </div>
        </section>

        {/* 🚀 OPERATING HOURS */}
        {institute.operatingHours && institute.operatingHours.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-amber-500" /> Weekly Operating Hours
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {institute.operatingHours.map((hour: any) => {
                const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                return (
                  <div key={hour.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <span className="font-semibold text-slate-700 text-sm">{days[hour.dayOfWeek] || `Day ${hour.dayOfWeek}`}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${hour.isClosed ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {hour.isClosed ? 'CLOSED' : `${hour.openTime} - ${hour.closeTime}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 🚀 PROS & CONS */}
        {(institute.pros?.length > 0 || institute.cons?.length > 0) && (
          <section className="grid md:grid-cols-2 gap-6">
            {institute.pros?.length > 0 && (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-6">
                <h3 className="text-lg font-bold text-emerald-900 flex items-center gap-2 mb-4">
                  <ThumbsUp className="w-5 h-5 text-emerald-600" /> Why Choose Us (Pros)
                </h3>
                <ul className="space-y-3">
                  {institute.pros.map((pro: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2.5 text-emerald-800 text-sm">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" /> {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {institute.cons?.length > 0 && (
              <div className="bg-red-50/30 border border-red-100 rounded-3xl p-6">
                <h3 className="text-lg font-bold text-red-900 flex items-center gap-2 mb-4">
                  <ThumbsDown className="w-5 h-5 text-red-500" /> Things to Consider (Cons)
                </h3>
                <ul className="space-y-3">
                  {institute.cons.map((con: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2.5 text-red-800 text-sm">
                      <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-red-400 mt-2" /> {con}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* 🚀 COURSES & BATCHES (ALL PLANS) */}
        {activeBatches.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><BookOpen className="w-6 h-6" /></div>
              <div>
                <h2 id="courses" className="scroll-mt-32 text-3xl font-bold text-slate-900">Courses & Batches</h2>
                <p className="text-slate-500 text-sm mt-1">Explore available programs and fee structures.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeBatches.map((batch: any) => {
                const calculatedSeatsLeft = batch.seatsTotal && batch.seatsTotal > 0
                  ? Math.max(0, batch.seatsTotal - (batch._count?.studentMembers || 0))
                  : null;
                const pct = (batch.seatsTotal && batch.seatsTotal > 0 && calculatedSeatsLeft !== null) ? calculatedSeatsLeft / batch.seatsTotal : null;
                return (
                  <div key={batch.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-lg text-slate-900 leading-tight">{batch.name}</h3>
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ACTIVE
                      </span>
                    </div>
                    <div className="space-y-2.5 text-sm text-slate-600 mb-4">
                      {batch.duration && <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> {batch.duration}</p>}
                      {batch.fee && <p className="flex items-center gap-2 font-bold text-slate-800"><IndianRupee className="w-4 h-4 text-emerald-500" /> {formatCurrency(batch.fee)}</p>}
                      {batch.timing && <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> {batch.timing}</p>}
                    </div>

                    {/* Seats logic */}
                    {pct !== null && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex justify-between text-xs font-semibold mb-2">
                          <span>Seats: {calculatedSeatsLeft} / {batch.seatsTotal} remaining</span>
                          {pct === 0 && <span className="text-rose-600">Full</span>}
                          {pct > 0 && pct < 0.3 && <span className="text-rose-600">Only {calculatedSeatsLeft} seats left 🔴</span>}
                          {pct >= 0.3 && pct < 0.6 && <span className="text-amber-600">Filling fast</span>}
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(1 - pct) * 100}%` }}></div>
                        </div>
                      </div>
                    )}

                    {batch.teachers?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {batch.teachers.slice(0, 3).map((bt: any, idx: number) => (
                            <div key={idx} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden" title={bt.teacher?.teacherProfile?.user?.name}>
                              {bt.teacher?.teacherProfile?.user?.image ? (
                                <Image src={bt.teacher.teacherProfile.user.image} alt="Teacher" width={32} height={32} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-full h-full p-1.5 text-slate-400" />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 text-xs font-semibold">Enquire →</Button>
                          {(isManager || userBatchIds.has(batch.id)) && (
                            <OpenBatchChatButton instituteId={id} batchId={batch.id} batchName={batch.name} />
                          )}
                        </div>
                      </div>
                    )}

                    {!(batch.teachers?.length > 0) && (isManager || userBatchIds.has(batch.id)) && (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                        <OpenBatchChatButton instituteId={id} batchId={batch.id} batchName={batch.name} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 🚀 STUDENTS & TEACHERS (COMMUNITY) */}
        <section>
          {/* Header & Stats Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Users className="w-6 h-6" /></div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="community" className="scroll-mt-32 text-3xl font-bold text-slate-900">Community</h2>
                  {hasUnlockedCommunity && institute.subscriptionPlan === "BASIC" && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border border-emerald-200">
                      <Unlock className="w-3 h-3" /> Unlocked (1 AFC)
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm mt-1">Connect with verified students and faculty of this institute.</p>
              </div>
            </div>

            {/* 📊 Member Stats Pills */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 text-xs shrink-0 self-start sm:self-center">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 px-2.5 py-1 bg-white rounded-xl shadow-2xs border border-slate-200">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Total Members:</span>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs font-extrabold">
                  {totalStudents + totalTeachers}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-slate-600 font-semibold">
                <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
                <span>{totalStudents} Students</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-slate-600 font-semibold">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>{totalTeachers} Faculty</span>
              </div>
            </div>
          </div>

          {isCommunityLocked ? (
            <div className="relative rounded-3xl overflow-hidden p-6 bg-slate-50/50 border border-slate-200/80 min-h-[360px] flex flex-col justify-center">
              <UnlockBasicFeaturesOverlay 
                title="Community" 
                instituteId={institute.id} 
                isLoggedIn={!!userId}
                description={`Unlock with 1 AFC Coin to access full student & faculty profiles, contact details, and direct messaging (${totalStudents + totalTeachers} Members).`} 
              />

              <div className="pointer-events-none select-none blur-[1px] opacity-75">
                <div className="space-y-8">
                  {/* STUDENTS PREVIEW */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><GraduationCap className="w-4 h-4" /></div>
                        <h3 className="text-lg font-bold text-slate-800">Students</h3>
                        <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                          {totalStudents} Profiles
                        </span>
                      </div>
                    </div>
                    {presentStudents.length > 0 ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {presentStudents.slice(0, 3).map((student: any) => {
                          const u = student.studentProfile.user;
                          return (
                            <div key={student.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex gap-4 items-center">
                              <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                                {u.image ? <Image src={u.image} alt={u.name} width={48} height={48} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2.5 text-slate-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 text-sm truncate">{u.name}</h4>
                                <p className="text-xs text-slate-500 truncate">{student.courseName}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 border border-blue-100">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 text-xs sm:text-sm">Students Directory (0 Enrolled)</h4>
                          <p className="text-[11px] sm:text-xs text-slate-500">Verified students who join this institute community will appear here.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FACULTY PREVIEW */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><UserCheck className="w-4 h-4" /></div>
                        <h3 className="text-lg font-bold text-slate-800">Faculty & Teachers</h3>
                        <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-100">
                          {totalTeachers} Profiles
                        </span>
                      </div>
                    </div>
                    {featuredFaculty.length > 0 ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {featuredFaculty.slice(0, 3).map((teacher: any) => {
                          const u = teacher.teacherProfile.user;
                          return (
                            <div key={teacher.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex gap-4 items-center">
                              <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                                {u.image ? <Image src={u.image} alt={u.name} width={48} height={48} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2.5 text-slate-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 text-sm truncate">{u.name}</h4>
                                <p className="text-xs text-slate-500 truncate">{teacher.designation}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-100">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 text-xs sm:text-sm">Faculty Directory (0 Listed)</h4>
                          <p className="text-[11px] sm:text-xs text-slate-500">Teachers and subject faculty of this institute will be featured here.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {/* STUDENTS */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><GraduationCap className="w-4 h-4" /></div>
                    <h3 className="text-xl font-bold text-slate-800">Students</h3>
                    <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                      {totalStudents} {totalStudents === 1 ? "Student" : "Students"}
                    </span>
                  </div>
                  {totalStudents > 3 && (
                    <MemberDrawer title="Students" total={totalStudents} type="STUDENT" instituteId={institute.id} />
                  )}
                </div>

                {presentStudents.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {presentStudents.slice(0, 3).map((student: any) => {
                      const u = student.studentProfile.user;
                      const canMessage = userId && userId !== u.id && u.allowDms && u.chatSettings?.allowDirectMessages;
                      return (
                        <div key={student.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex gap-4 items-center">
                          <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                            {u.image ? <Image src={u.image} alt={u.name} width={48} height={48} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2.5 text-slate-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate">{u.name}</h4>
                            <p className="text-xs text-slate-500 truncate">{student.courseName} {student.batchYear ? `· ${student.batchYear}` : ''}</p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Verified</span>
                              <span className="text-[10px] font-bold text-slate-500">Active</span>
                            </div>
                            {student.bio && <p className="text-xs text-slate-600 mt-2 truncate">{student.bio}</p>}
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <Link href={`/u/${u.username}`} className="text-xs text-blue-600 hover:underline">Profile</Link>
                            {canMessage && <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100"><Link href={`/chat?userId=${u.id}`}>Message →</Link></Button>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 border border-blue-100">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-xs sm:text-sm">Students Directory (0 Enrolled)</h4>
                      <p className="text-[11px] sm:text-xs text-slate-500">Verified students who join this institute community will appear here.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* TEACHERS / FACULTY */}
              {institute.providerType !== 'INDIVIDUAL' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><UserCheck className="w-4 h-4" /></div>
                      <h3 className="text-xl font-bold text-slate-800">Faculty & Teachers</h3>
                      <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-100">
                        {totalTeachers} {totalTeachers === 1 ? "Teacher" : "Teachers"}
                      </span>
                    </div>
                    {totalTeachers > 3 && (
                      <MemberDrawer title="Faculty" total={totalTeachers} type="TEACHER" instituteId={institute.id} />
                    )}
                  </div>

                  {featuredFaculty.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {featuredFaculty.slice(0, 3).map((teacher: any) => {
                        const u = teacher.teacherProfile.user;
                        const canMessage = userId && userId !== u.id && u.allowDms && u.chatSettings?.allowDirectMessages;
                        return (
                          <div key={teacher.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                              {u.image ? <Image src={u.image} alt={u.name} width={48} height={48} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2.5 text-slate-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-slate-900 text-sm truncate">{u.name}</h4>
                              <p className="text-xs text-slate-500 truncate">{teacher.designation}</p>
                              <div className="flex gap-2 mt-1">
                                <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Verified</span>
                                {teacher.isFeatured && <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-500" /> Featured</span>}
                              </div>
                              {teacher.teachingSubjects && <p className="text-[10px] font-semibold text-emerald-600 mt-2 truncate">Subjects: {teacher.teachingSubjects}</p>}
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                              <Link href={`/u/${u.username}`} className="text-xs text-blue-600 hover:underline">Profile</Link>
                              {canMessage && <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100"><Link href={`/chat?userId=${u.id}`}>Message →</Link></Button>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-100">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 text-xs sm:text-sm">Faculty Directory (0 Listed)</h4>
                        <p className="text-[11px] sm:text-xs text-slate-500">Teachers and subject faculty of this institute will be featured here.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MANAGERS */}
              {instituteManagers.length > 0 && (
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-xl font-bold text-slate-800">Managers</h3>
                    {instituteManagers.length > 3 && (
                      <MemberDrawer title="Managers" total={instituteManagers.length} type="MANAGER" instituteId={institute.id} />
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {instituteManagers.slice(0, 3).map((manager: any) => {
                      const u = manager.user;
                      const canMessage = userId && userId !== u.id && u.allowDms && u.chatSettings?.allowDirectMessages;
                      return (
                        <div key={manager.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex gap-4 items-center">
                          <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                            {u.image ? <Image src={u.image} alt={u.name} width={48} height={48} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2.5 text-slate-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate">{u.name}</h4>
                            <p className="text-xs text-slate-500 truncate">Institute Manager</p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Verified</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <Link href={`/u/${u.username}`} className="text-xs text-blue-600 hover:underline">Profile</Link>
                            {canMessage && <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100"><Link href={`/chat?userId=${u.id}`}>Message →</Link></Button>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-4 border-t border-slate-100">
                <Button asChild variant="outline" className="rounded-full shadow-sm">
                  <Link href={`/institute/${institute.id}-${institute.slug}/members`}>
                    View All Directory Members
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </section>



        {/* 🚀 NOTABLE ALUMNI */}
        {(!hasUltraAccess || (institute.notablepersons && institute.notablepersons.length > 0)) && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-pink-100 text-pink-600 rounded-xl"><Award className="w-6 h-6" /></div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Notable Alumni</h2>
                <p className="text-slate-500 text-sm mt-1">Meet the successful students of this academy.</p>
              </div>
            </div>

            {/* 🔥 FIX: min-h-[350px] added */}
            <div className={`relative rounded-3xl overflow-hidden pb-4 ${!hasUltraAccess ? 'min-h-[350px] flex flex-col justify-center' : ''}`}>
              {!hasUltraAccess && <LockedOverlay title="Alumni Network" instituteId={institute.id} slug={institute.slug} />}

              <div className={`flex overflow-x-auto gap-5 snap-x ${!hasUltraAccess ? 'opacity-40 blur-[4px] pointer-events-none select-none grayscale-[50%] overflow-hidden' : ''}`}>
                {hasUltraAccess ? (
                  institute.notablepersons.map((person: any) => (
                    <div key={person.id} className="min-w-[220px] bg-white border border-slate-200 rounded-3xl p-5 shadow-sm snap-start flex flex-col items-center text-center">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border-2 border-pink-100 mb-3">
                        {isCloudinaryImage(person.imageUrl) ? (
                          <Image src={person.imageUrl} alt={person.name} width={80} height={80} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-slate-300 m-auto mt-5" />
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900">{person.name}</h4>
                      {person.placedAt && <p className="text-sm text-pink-600 font-semibold mt-1">{person.placedAt}</p>}
                      {person.package && <p className="text-xs text-slate-500 mt-1 bg-slate-100 px-2 py-1 rounded-md">{person.package}</p>}
                    </div>
                  ))
                ) : (
                  // Placeholders
                  [1, 2, 3, 4].map((i: number) => (
                    <div key={i} className="min-w-[220px] bg-white border border-slate-200 rounded-3xl p-5 flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-amber-200 mb-3"></div>
                      <div className="h-5 w-2/3 bg-amber-200 rounded mb-2"></div>
                      <div className="h-4 w-1/2 bg-amber-200 rounded"></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* 🚀 CLASSROOM IMAGES */}
        {(!hasUltraAccess || validClassroomImages.length > 0) && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Presentation className="w-6 h-6" /></div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Campus & Classrooms</h2>
                <p className="text-slate-500 text-sm mt-1">Take a look inside our modern learning environments.</p>
              </div>
            </div>

            {/* 🔥 FIX: min-h-[350px] added */}
            <div className={`relative rounded-3xl overflow-hidden ${!hasUltraAccess ? 'min-h-[350px]' : ''}`}>
              {!hasUltraAccess && <LockedOverlay title="Infrastructure Images" instituteId={institute.id} slug={institute.slug} />}

              <InteractiveGallery
                images={validClassroomImages}
                altPrefix={`${institute.name} Classroom`}
                hasUltraAccess={hasUltraAccess}
              />
            </div>
          </section>
        )}

        {/* GALLERY IMAGES */}
        {(!hasUltraAccess || validGalleryImages.length > 0) && (
          <section className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><Trophy className="w-6 h-6" /></div>
              <div>
                <h2 id="gallery" className="scroll-mt-32 text-3xl font-bold text-slate-900">Gallery</h2>
                <p className="text-slate-500 text-sm mt-1">Glimpses of events, results, and milestones.</p>
              </div>
            </div>

            {/* The Content Wrapper */}
            <div className="relative rounded-3xl overflow-hidden">

              {/* Overlay if not Ultra */}
              {!hasUltraAccess && (
                <LockedOverlay title="Gallery" instituteId={institute.id} slug={institute.slug} />
              )}

              {/* Grid Content (Actual or Mock for Blur) */}
              <InteractiveGallery
                images={validGalleryImages}
                altPrefix="Gallery Image"
                hasUltraAccess={hasUltraAccess}
              />
            </div>
          </section>
        )}

        {/* YOUTUBE VIDEOS */}
        {(!hasUltraAccess || (institute.youtubeVideos && institute.youtubeVideos.length > 0)) && (
          <section className="relative mt-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl"><PlayCircle className="w-6 h-6" /></div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Featured Videos</h2>
                <p className="text-slate-500 text-sm mt-1">Watch demo classes and academy tours.</p>
              </div>
            </div>

            <div className="relative rounded-3xl overflow-hidden">

              {/* Overlay if not Ultra */}
              {!hasUltraAccess && (
                <LockedOverlay title="Video Gallery" instituteId={institute.id} slug={institute.slug} />
              )}

              <div className={`grid gap-6 sm:grid-cols-2 ${!hasUltraAccess ? 'opacity-40 pointer-events-none select-none grayscale-[50%]' : ''}`}>

                {hasUltraAccess ? (
                  // Actual Videos
                  institute.youtubeVideos.map((url: string, idx: number) => {
                    const videoId = getYouTubeId(url);
                    if (!videoId) return null;
                    return (
                      <div key={idx} className="aspect-video w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm">
                        <iframe src={`https://www.youtube.com/embed/${videoId}`} className="h-full w-full border-0" />
                      </div>
                    );
                  })
                ) : (
                  // Mock Placeholders for Basic Plan
                  [1, 2].map((i: number) => (
                    <div key={i} className="aspect-video w-full rounded-3xl bg-amber-200 flex items-center justify-center">
                      <PlayCircle className="w-12 h-12 text-black" />
                    </div>
                  ))
                )}

              </div>
            </div>
          </section>
        )}

        {/* 🚀 FAQs (ULTRA FEATURE) */}
        {(!hasUltraAccess || (institute.faqs && institute.faqs.length > 0)) && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <HelpCircle className="w-6 h-6 text-slate-700" />
              <h2 id="faqs" className="scroll-mt-32 text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
            </div>

            {/* 🔥 FIX: Yahan relative div lagaya hai heading ke neeche, with min-h */}
            <div className={`relative rounded-2xl overflow-hidden ${!hasUltraAccess ? 'min-h-[350px] flex flex-col justify-center' : ''}`}>
              {!hasUltraAccess && <LockedOverlay title="FAQs" instituteId={institute.id} slug={institute.slug} />}

              <div className={`space-y-6 ${!hasUltraAccess ? 'opacity-30 blur-[4px] pointer-events-none select-none' : ''}`}>
                {hasUltraAccess ? (
                  institute.faqs.map((faq: { id: string, question: string, answer: string }) => (
                    <div key={faq.id}>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Q. {faq.question}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  ))
                ) : (
                  // Placeholders
                  [1, 2, 3].map((i: number) => (
                    <div key={i}>
                      <div className="h-6 w-3/4 bg-amber-200 rounded mb-2"></div>
                      <div className="h-4 w-full bg-amber-200 rounded mb-1"></div>
                      <div className="h-4 w-5/6 bg-amber-200 rounded"></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* Location Map */}
        {institute.latitude && institute.longitude && (
          <section>
            <h2 className="mb-6 text-3xl font-bold text-slate-900">Location Map</h2>
            <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
              <InstituteMap name={institute.name} latitude={institute.latitude} longitude={institute.longitude} />
            </div>
          </section>
        )}


        {/* ── UPDATES & BLOGS ── */}
        {formattedBlogs.length > 0 && (
          <section className="relative mt-16">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><BookOpen className="w-6 h-6" /></div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Updates & Articles</h2>
                  <p className="mt-1 text-slate-500 text-sm">Read the latest news and insights from {institute.name}</p>
                </div>
              </div>
              <Link
                href={`/institute/${idSlug}/blogs`}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700 hidden sm:block"
              >
                View All Articles →
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {formattedBlogs.map((post: any) => (
                <BlogCard key={post.id} post={post as BlogCardPost} />
              ))}
            </div>
            <div className="mt-6 sm:hidden flex justify-center">
              <Link
                href={`/institute/${idSlug}/blogs`}
                className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
              >
                View All Articles
              </Link>
            </div>
          </section>
        )}

        {/* Reviews Section */}
        <section>
          <h2 id="reviews" className="scroll-mt-32 text-3xl font-bold text-slate-900">AcademyFind Reviews</h2>
          <p className="mt-2 text-slate-600">Share your personal experience with this institute.</p>
          <div className="mt-6 space-y-4">
            {institute.reviews.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
                Be the first to review {institute.name} on our platform!
              </div>
            ) : (
              institute.reviews.map((review: any) => (
                <ReviewItem key={review.id} review={review} isLoggedIn={!!userId} />
              ))
            )}
          </div>
          <div className="mt-8">
            <ReviewForm instituteId={institute.id} isLoggedIn={!!userId} />
          </div>
        </section>

        {/* SIMILAR INSTITUTES */}
        {similarInstitutes.length > 0 && (
          <section className="border-t border-slate-200 pt-16 mt-16">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">
                  Similar Institutes in {institute.city.name}
                </h2>
                <p className="mt-2 text-slate-500">
                  Explore other top-rated options for {institute.categories[0]?.category.name}.
                </p>
              </div>
              <Link href={`/${institute.categories[0]?.category.slug}/${institute.city.slug}`} className="text-sm font-bold text-amber-600 hover:text-amber-700 transition">
                View All →
              </Link>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similarInstitutes.map((simInst: any) => {
                const simDisplayLogo = isCloudinaryImage(simInst.imageUrl)
                  ? simInst.imageUrl
                  : (isCloudinaryImage(simInst.logo) ? simInst.logo : "/no_image/coaching_inst.PNG");

                return (
                  <Link
                    href={`/institute/${simInst.id}-${simInst.slug}`}
                    key={simInst.id}
                    className="group flex flex-col rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 relative">
                      <img
                        src={simDisplayLogo}
                        alt={simInst.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {simInst.isVerified && (
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                          <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-[10px] font-bold text-slate-700">Verified</span>
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md line-clamp-1">
                          {simInst.categories[0]?.category.name}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-lg line-clamp-1 group-hover:text-amber-600 transition-colors">
                        {simInst.name}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1.5 flex items-start gap-1.5 line-clamp-2">
                        <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                        {simInst.address || simInst.city.name}
                      </p>

                      <div className="mt-auto pt-5 flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-bold text-slate-800">
                            {simInst.googleRating > 0 ? simInst.googleRating : "New"}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-400">({simInst.googleReviewCount} reviews)</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}