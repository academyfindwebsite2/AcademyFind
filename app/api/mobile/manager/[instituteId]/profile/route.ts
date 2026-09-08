import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { instituteId } = await params;

    // Verify manager access
    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId },
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      include: {
        city: true,
        categories: { include: { category: true } },
        facilities: { orderBy: { order: 'asc' } },
        highlightStats: { orderBy: { order: 'asc' } },
        operatingHours: { orderBy: { dayOfWeek: 'asc' } },
        faqs: { orderBy: { order: 'asc' } },
      },
    });

    if (!institute) {
      return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });
    }

    // Fetch active categories for course tagging
    const allCategories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });

    const isLocked = institute.subscriptionPlan === 'BASIC' || !institute.subscriptionPlan;

    return NextResponse.json({
      success: true,
      data: institute,
      allCategories,
      isLocked,
      subscriptionPlan: institute.subscriptionPlan || 'BASIC',
    });
  } catch (error: any) {
    console.error('Error in mobile profile GET:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { instituteId } = await params;

    const isManager = await prisma.instituteManager.findFirst({
      where: { userId: session.user.id, instituteId },
    });
    if (!isManager && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const existing = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, subscriptionPlan: true, isPublished: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Institute not found' }, { status: 404 });
    }

    // Plan check: basic tier cannot edit profile
    if (existing.subscriptionPlan === 'BASIC' || !existing.subscriptionPlan) {
      return NextResponse.json(
        {
          success: false,
          error: 'Profile editing is locked on the Basic plan. Upgrade to Verified or Premium to customize.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      name,
      description,
      phone,
      email,
      website,
      address,
      feeInfo,
      latitude,
      longitude,
      googleMapsUrl,
      mode,
      providerType,
      tagline,
      establishedYear,
      totalStudents,
      totalBranches,
      feeMin,
      feeMax,
      refundPolicy,
      brochureUrl,
      isPublished,
      hasOnlineClasses,
      hasHostelFacility,
      hasDemoClasses,
      hasScholarship,
      hasCertification,
      pros,
      cons,
      affiliations,
      awards,
      mediumOfInstruction,
      metaTitle,
      metaDescription,
      imageUrl,
      coverImage,
      logo,
      gallery,
      youtubeVideos,
      facebookUrl,
      instagramUrl,
      twitterUrl,
      youtubeUrl,
      telegramUrl,
      whatsappUrl,
      linkedinUrl,
      categories,
      facilities,
      highlightStats,
    } = body;

    // Execute update in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const inst = await tx.institute.update({
        where: { id: instituteId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(phone !== undefined && { phone }),
          ...(email !== undefined && { email }),
          ...(website !== undefined && { website }),
          ...(address !== undefined && { address }),
          ...(feeInfo !== undefined && { feeInfo }),
          ...(googleMapsUrl !== undefined && { googleMapsUrl }),
          ...(latitude !== undefined ? { latitude: latitude !== null ? parseFloat(String(latitude)) : null } : {}),
          ...(longitude !== undefined ? { longitude: longitude !== null ? parseFloat(String(longitude)) : null } : {}),
          ...(mode && { mode }),
          ...(providerType && { providerType }),
          ...(tagline !== undefined && { tagline }),
          ...(establishedYear !== undefined ? { establishedYear: establishedYear ? parseInt(String(establishedYear), 10) : null } : {}),
          ...(totalStudents !== undefined ? { totalStudents: totalStudents ? parseInt(String(totalStudents), 10) : null } : {}),
          ...(totalBranches !== undefined ? { totalBranches: totalBranches ? parseInt(String(totalBranches), 10) : null } : {}),
          ...(feeMin !== undefined ? { feeMin: feeMin ? parseInt(String(feeMin), 10) : null } : {}),
          ...(feeMax !== undefined ? { feeMax: feeMax ? parseInt(String(feeMax), 10) : null } : {}),
          ...(refundPolicy !== undefined && { refundPolicy }),
          ...(brochureUrl !== undefined && { brochureUrl }),
          ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
          ...(hasOnlineClasses !== undefined && { hasOnlineClasses: Boolean(hasOnlineClasses) }),
          ...(hasHostelFacility !== undefined && { hasHostelFacility: Boolean(hasHostelFacility) }),
          ...(hasDemoClasses !== undefined && { hasDemoClasses: Boolean(hasDemoClasses) }),
          ...(hasScholarship !== undefined && { hasScholarship: Boolean(hasScholarship) }),
          ...(hasCertification !== undefined && { hasCertification: Boolean(hasCertification) }),
          ...(pros !== undefined && { pros: Array.isArray(pros) ? pros : [] }),
          ...(cons !== undefined && { cons: Array.isArray(cons) ? cons : [] }),
          ...(affiliations !== undefined && { affiliations: Array.isArray(affiliations) ? affiliations : [] }),
          ...(awards !== undefined && { awards: Array.isArray(awards) ? awards : [] }),
          ...(mediumOfInstruction !== undefined && { mediumOfInstruction: Array.isArray(mediumOfInstruction) ? mediumOfInstruction : [] }),
          ...(metaTitle !== undefined && { metaTitle }),
          ...(metaDescription !== undefined && { metaDescription }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(coverImage !== undefined && { coverImage }),
          ...(logo !== undefined && { logo }),
          ...(gallery !== undefined && { gallery }),
          ...(youtubeVideos !== undefined && { youtubeVideos }),
          ...(facebookUrl !== undefined && { facebookUrl }),
          ...(instagramUrl !== undefined && { instagramUrl }),
          ...(twitterUrl !== undefined && { twitterUrl }),
          ...(youtubeUrl !== undefined && { youtubeUrl }),
          ...(telegramUrl !== undefined && { telegramUrl }),
          ...(whatsappUrl !== undefined && { whatsappUrl }),
          ...(linkedinUrl !== undefined && { linkedinUrl }),
        },
      });

      // Notification if published status changes
      if (isPublished !== undefined && isPublished !== existing.isPublished) {
        if (isPublished) {
          await tx.adminNotification.create({
            data: {
              type: 'INSTITUTE_PUBLISHED',
              title: 'Institute Published',
              message: `${inst.name} has been published and is now visible to students.`,
            },
          });
        } else {
          await tx.adminNotification.create({
            data: {
              type: 'INSTITUTE_UNPUBLISHED',
              title: 'Institute Unpublished',
              message: `${inst.name} has been unpublished and is hidden from search results.`,
            },
          });
        }
      }

      // Sync Categories if provided
      if (Array.isArray(categories)) {
        await tx.instituteCategory.deleteMany({ where: { instituteId } });
        if (categories.length > 0) {
          await tx.instituteCategory.createMany({
            data: categories.map((catId: string) => ({
              instituteId,
              categoryId: catId,
            })),
          });
        }
      }

      // Sync Facilities if provided
      if (Array.isArray(facilities)) {
        await tx.instituteFacility.deleteMany({ where: { instituteId } });
        if (facilities.length > 0) {
          await tx.instituteFacility.createMany({
            data: facilities
              .filter((f: any) => f && f.name && String(f.name).trim())
              .map((f: any, idx: number) => ({
                instituteId,
                name: String(f.name).trim(),
                available: f.available ?? true,
                order: idx,
              })),
          });
        }
      }

      // Sync Highlight Stats if provided
      if (Array.isArray(highlightStats)) {
        await tx.instituteHighlightStat.deleteMany({ where: { instituteId } });
        if (highlightStats.length > 0) {
          await tx.instituteHighlightStat.createMany({
            data: highlightStats
              .filter((s: any) => s && s.label && s.value)
              .map((s: any, idx: number) => ({
                instituteId,
                label: String(s.label).trim(),
                value: String(s.value).trim(),
                icon: s.icon ? String(s.icon).trim() : null,
                order: idx,
              })),
          });
        }
      }

      return inst;
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully!',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in mobile profile PUT:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update institute profile.' },
      { status: 500 }
    );
  }
}
