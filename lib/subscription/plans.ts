export interface PlanFeature {
  text: string;
  subtext?: string;
  isBold?: boolean;
  highlight?: "trophy" | "lms" | "users" | "forum";
  badge?: string;
}

export interface PlanConfig {
  id: "VERIFIED" | "PREMIUM" | "ULTRA";
  name: string;
  desc: string;
  badge?: string;
  topBadge?: string;
  actionText: string;
  pricing: {
    monthly: { original?: number; offer: number };
    annual: { original: number; offer: number };
  };
  features: PlanFeature[];
}

export const SUBSCRIPTION_PLANS: PlanConfig[] = [
  {
    id: "VERIFIED",
    name: "Verified",
    desc: "Build trust and start capturing student leads.",
    actionText: "Get Started",
    pricing: {
      monthly: { offer: 199 },
      annual: { original: 2999, offer: 1999 },
    },
    features: [
      { text: "Edit your profile" },
      { text: "Verified badge" },
      { text: "Institute name, address & contact details" },
      { text: "Detailed course information" },
      { text: "Appear in search results" },
      {
        text: "Direct lead generation from your institute page",
        isBold: true,
        subtext:
          "All enquiries (calls, WhatsApp, emails & forms) will appear in your manager dashboard in real time",
      },
      { text: "Access to AcademyFind resources" },
    ],
  },
  {
    id: "PREMIUM",
    name: "Premium",
    desc: "Showcase your institute, build your community, engage more students, and track your growth.",
    topBadge: "MOST POPULAR",
    actionText: "Get Premium",
    pricing: {
      monthly: { offer: 499 },
      annual: { original: 9999, offer: 4999 },
    },
    features: [
      { text: "Everything in Verified", isBold: true },
      {
        text: "See who viewed your profile",
        isBold: true,
        subtext: "Get contact details of visitors, even if they don't submit an enquiry",
      },
      {
        text: "Showcase your students and teachers",
        highlight: "users",
        subtext:
          "Create your own space where your students and faculty can manage their profiles (like social media) and let visitors see and interact with them",
      },
      {
        text: "Institute Forum",
        highlight: "forum",
        subtext:
          "A dedicated forum for your students and faculty to connect, discuss, share updates and stay engaged",
      },
      { text: "Add social media links" },
      { text: "Photos and videos (institute gallery)" },
      { text: "Showcase results, achievements and testimonials" },
      {
        text: "Advanced profile analytics",
        subtext: "Track views, searches and real-time enquiries",
      },
      {
        text: "Priority enquiries (real-time)",
        subtext: "Get noticed by serious students first",
      },
      { text: "Dedicated support" },
    ],
  },
  {
    id: "ULTRA",
    name: "Elite",
    desc: "Maximum visibility, top rankings and advanced lead management to grow your institute.",
    topBadge: "Best for Maximum Growth",
    actionText: "Get Elite",
    pricing: {
      monthly: { offer: 999 },
      annual: { original: 29999, offer: 9999 },
    },
    features: [
      { text: "Everything in Premium", isBold: true },
      {
        text: "Top position in your area & category",
        highlight: "trophy",
        isBold: true,
        subtext:
          "Your institute will be shown at the top in relevant search results in your selected area and category.",
      },
      {
        text: "Lead Management System (LMS)",
        highlight: "lms",
        badge: "NEW",
        isBold: true,
        subtext: "Manage, track and convert all your enquiries in one place.",
      },
      {
        text: "Enquiry dashboard with complete lead details",
        subtext: "Get contact details even when someone just visits your page",
      },
      { text: "Automated follow-ups and status updates" },
      { text: "Student enquiry history and notes" },
      { text: "Team access for counsellors/staff" },
      { text: "Advanced analytics and performance reports" },
      { text: "Area-specific visibility (top in your area)" },
      { text: "Category-specific visibility (top in your category)" },
      { text: "Priority support and account management" },
      { text: "Early access to new features" },
    ],
  },
];

export const SUBSCRIPTION_BENEFITS = [
  {
    icon: "users",
    title: "Reach More Students",
    desc: "Get discovered by thousands of students and parents.",
  },
  {
    icon: "chart",
    title: "Better Enquiries",
    desc: "Quality leads that convert.",
  },
  {
    icon: "tools",
    title: "Manage Easily",
    desc: "Save time with powerful tools like LMS.",
  },
  {
    icon: "rocket",
    title: "Grow Faster",
    desc: "Build your brand and increase admissions.",
  },
];
