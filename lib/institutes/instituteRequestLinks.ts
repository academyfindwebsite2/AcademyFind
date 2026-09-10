export function getProductionBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/$/, "");
  }
  if (
    typeof window !== "undefined" &&
    window.location.origin &&
    !window.location.origin.includes("localhost")
  ) {
    return window.location.origin;
  }
  return "https://www.academyfind.com";
}

export function buildInstituteRequestLinks(institute: { id: string; name?: string | null; slug?: string | null }) {
  const baseUrl = getProductionBaseUrl();
  const instituteId = institute.id;
  const rawSlug = institute.slug || institute.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "";
  const slug = rawSlug.replace(/^-+|-+$/g, "");
  const publicListingUrl = slug ? `${baseUrl}/institute/${instituteId}-${slug}` : `${baseUrl}/institute/${instituteId}`;
  const managerDashboardUrl = `${baseUrl}/manager/${instituteId}`;
  return { publicListingUrl, managerDashboardUrl, baseUrl };
}

export function buildInstituteRequestWhatsAppMessage(params: {
  managerName: string;
  instituteName: string;
  publicListingUrl: string;
  managerDashboardUrl: string;
}): string {
  return `🎉 *Congratulations ${params.managerName}!*

We are pleased to inform you that your listing request for *${params.instituteName}* has been officially verified & *APPROVED* on AcademyFind!

You now have full manager access to your profile:

🌐 *View Your Public Listing:*
${params.publicListingUrl}

📊 *Access Manager Dashboard:*
${params.managerDashboardUrl}

*What you can do in your dashboard:*
✅ Update institute info, courses, & fee structure
✅ Add batches, facilities & gallery photos
✅ View student enquiry leads & callbacks
✅ Respond to student reviews

If you need any assistance, feel free to reply directly to this message.

Best Regards,
*Team AcademyFind*
🌐 www.academyfind.com`;
}
