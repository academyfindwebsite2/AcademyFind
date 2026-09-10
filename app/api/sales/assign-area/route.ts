import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/prisma";
import { meili } from "@/lib/meilisearch";
import { NextRequest, NextResponse } from "next/server";
import { sendExpoPushNotification } from "@/lib/pushNotifications";
import { sendEmail } from "@/lib/notifications/email";

// ─── Haversine distance formula ───────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── GET: Preview institutes within radius using Meilisearch + DB ───────────────
// Query: ?lat=28.65&lng=77.19&radius=3&salesManagerId=xxx&areaName=Karol+Bagh
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const lat = parseFloat(searchParams.get("lat") || "");
        const lng = parseFloat(searchParams.get("lng") || "");
        const radius = parseFloat(searchParams.get("radius") || "3");
        const salesManagerId = searchParams.get("salesManagerId") || "";
        const areaName = searchParams.get("areaName") || "";

        if (isNaN(lat) || isNaN(lng) || !salesManagerId) {
            return NextResponse.json({ error: "lat, lng, and salesManagerId are required" }, { status: 400 });
        }

        const radiusInMeters = Math.round(radius * 1000);
        let meiliMatchedIds: string[] = [];

        // ⚡ 1. Meilisearch Fast Geospatial Search
        try {
            const meiliRes = await meili.index("global_search").search("", {
                filter: [
                    `type = "institute"`,
                    `_geoRadius(${lat}, ${lng}, ${radiusInMeters})`,
                ],
                limit: 500,
                sort: [`_geoPoint(${lat}, ${lng}):asc`],
            });

            if (meiliRes?.hits && meiliRes.hits.length > 0) {
                meiliMatchedIds = meiliRes.hits
                    .map((h: any) => h.prismaId || (typeof h.id === "string" && h.id.startsWith("inst-") ? h.id.replace("inst-", "") : h.id))
                    .filter(Boolean);
            }
        } catch (meiliErr) {
            console.warn("Meilisearch _geoRadius search fallback to DB:", meiliErr);
        }

        // 🗄️ 2. DB Query for Institutes
        const institutesQuery: any = {
            isActive: true,
            OR: [
                ...(meiliMatchedIds.length > 0 ? [{ id: { in: meiliMatchedIds } }] : []),
                { latitude: { not: null }, longitude: { not: null } },
                ...(areaName ? [{ address: { contains: areaName, mode: "insensitive" } }] : []),
            ],
        };

        const dbInstitutes = await prisma.institute.findMany({
            where: institutesQuery,
            select: {
                id: true,
                name: true,
                address: true,
                phone: true,
                latitude: true,
                longitude: true,
                city: { select: { name: true } },
                salesAssignments: {
                    select: {
                        id: true,
                        salesManagerId: true,
                        contactStatus: true,
                        salesManager: { select: { id: true, name: true } },
                    },
                },
            },
        });

        // 3. Filter strictly within radius & calculate exact distance
        const matchedInstitutes: any[] = [];
        const seenIds = new Set<string>();

        // Prioritize Meilisearch matched ones first if available
        for (const inst of dbInstitutes) {
            if (seenIds.has(inst.id)) continue;

            let distance: number | null = null;
            if (inst.latitude && inst.longitude) {
                distance = haversineKm(lat, lng, inst.latitude, inst.longitude);
                if (distance <= radius) {
                    seenIds.add(inst.id);
                    matchedInstitutes.push({ ...inst, distanceKm: distance });
                }
            } else if (areaName && inst.address && inst.address.toLowerCase().includes(areaName.toLowerCase())) {
                seenIds.add(inst.id);
                matchedInstitutes.push({ ...inst, distanceKm: null });
            }
        }

        // Sort by distance ascending
        matchedInstitutes.sort((a, b) => {
            if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
            if (a.distanceKm !== null) return -1;
            if (b.distanceKm !== null) return 1;
            return 0;
        });

        const allMatched = matchedInstitutes;

        // Categorise each institute
        const result = allMatched.map((inst: any) => {
            const assignment = inst.salesAssignments ?? null;
            let status: "FREE" | "ASSIGNED_TO_YOU" | "ASSIGNED_TO_OTHER";

            if (!assignment) {
                status = "FREE";
            } else if (assignment.salesManagerId === salesManagerId) {
                status = "ASSIGNED_TO_YOU";
            } else {
                status = "ASSIGNED_TO_OTHER";
            }

            return {
                id: inst.id,
                name: inst.name,
                address: inst.address,
                phone: inst.phone,
                city: inst.city?.name,
                hasCoords: inst.latitude !== null,
                distanceKm:
                    inst.latitude && inst.longitude
                        ? Math.round(haversineKm(lat, lng, inst.latitude, inst.longitude) * 10) / 10
                        : null,
                status,
                currentManager:
                    status === "ASSIGNED_TO_OTHER" && assignment
                        ? {
                              id: assignment.salesManagerId,
                              name: assignment.salesManager?.name || "Unknown",
                          }
                        : null,
            };
        });

        // Sort by distance asc (coords first, then address matches)
        result.sort((a, b) => {
            if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
            if (a.distanceKm !== null) return -1;
            if (b.distanceKm !== null) return 1;
            return 0;
        });

        const summary = {
            total: result.length,
            free: result.filter((r) => r.status === "FREE").length,
            assignedToYou: result.filter((r) => r.status === "ASSIGNED_TO_YOU").length,
            assignedToOther: result.filter((r) => r.status === "ASSIGNED_TO_OTHER").length,
        };

        return NextResponse.json({ success: true, summary, institutes: result });
    } catch (error) {
        console.error("Assign area preview error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// ─── POST: Bulk assign institutes in area ───────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = await req.json();
        const {
            salesManagerId,
            lat,
            lng,
            radiusKm,
            areaName,
            deadline,
            includeReassign,   // boolean: reassign from other managers too
            specificInstituteIds, // optional: array of ids to assign (if admin deselected some)
        } = body;

        if (!salesManagerId || isNaN(lat) || isNaN(lng)) {
            return NextResponse.json(
                { error: "salesManagerId, lat, lng are required" },
                { status: 400 }
            );
        }

        const manager = await prisma.user.findUnique({
            where: { id: salesManagerId },
            select: { id: true, role: true, email: true, name: true, pushToken: true },
        });

        if (!manager || manager.role !== "SALES_MANAGER") {
            return NextResponse.json({ error: "User is not a Sales Manager" }, { status: 400 });
        }

        // Determine which institutes to assign
        let instituteIds: string[] = [];

        if (specificInstituteIds && Array.isArray(specificInstituteIds) && specificInstituteIds.length > 0) {
            instituteIds = specificInstituteIds;
        } else {
            // Repeat the preview logic to get all institutes in area
            const institutesWithCoords = await prisma.institute.findMany({
                where: { latitude: { not: null }, longitude: { not: null }, isActive: true },
                select: {
                    id: true,
                    latitude: true,
                    longitude: true,
                    salesAssignments: { select: { salesManagerId: true } },
                },
            });

            const inRadius = institutesWithCoords.filter(
                (i) => haversineKm(lat, lng, i.latitude!, i.longitude!) <= radiusKm
            );

            const addressMatches: any[] = areaName
                ? await prisma.institute.findMany({
                      where: {
                          isActive: true,
                          OR: [{ latitude: null }, { longitude: null }],
                          address: { contains: areaName, mode: "insensitive" },
                      },
                      select: {
                          id: true,
                          salesAssignments: { select: { salesManagerId: true } },
                      },
                  })
                : [];

            const seen = new Set(inRadius.map((i) => i.id));
            const allCandidates: any[] = [
                ...inRadius,
                ...addressMatches.filter((i) => !seen.has(i.id)),
            ];

            for (const inst of allCandidates) {
                const existing = (inst as any).salesAssignments;
                if (!existing) {
                    // Free → always assign
                    instituteIds.push(inst.id);
                } else if (existing.salesManagerId === salesManagerId) {
                    // Already assigned to this manager → skip
                } else if (includeReassign) {
                    // Assigned to other manager → reassign only if flag set
                    instituteIds.push(inst.id);
                }
            }
        }

        if (instituteIds.length === 0) {
            return NextResponse.json({ success: true, assigned: 0, message: "No institutes to assign." });
        }

        // ── Create the parent SalesAreaAssignment record ──────────────────────
        const areaAssignment = await prisma.salesAreaAssignment.create({
            data: {
                salesManagerId,
                areaName: areaName || "Unknown Area",
                latitude: lat,
                longitude: lng,
                radiusKm: radiusKm || 3,
                deadline: deadline ? new Date(deadline) : null,
            },
        });

        // ── Bulk upsert individual SalesAssignments, linked to the area ───────
        let assigned = 0;
        const errors: string[] = [];

        for (const instituteId of instituteIds) {
            try {
                await prisma.salesAssignment.upsert({
                    where: { instituteId },
                    update: {
                        salesManagerId,
                        areaAssignmentId: areaAssignment.id,
                        deadline: deadline ? new Date(deadline) : null,
                    },
                    create: {
                        salesManagerId,
                        instituteId,
                        areaAssignmentId: areaAssignment.id,
                        deadline: deadline ? new Date(deadline) : null,
                    },
                });
                assigned++;
            } catch (err) {
                console.error(`Failed to assign institute ${instituteId}:`, err);
                errors.push(instituteId);
            }
        }


        // Send push + email notification to manager (single summary)
        const deadlineText = deadline
            ? new Date(deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : null;
        const notifBody = `You have been assigned ${assigned} institute${assigned !== 1 ? "s" : ""} in ${areaName || "an area"}${deadlineText ? ` (Deadline: ${deadlineText})` : ""}.`;

        try {
            await prisma.userNotification.create({
                data: {
                    userId: salesManagerId,
                    type: "SYSTEM",
                    title: `📍 Area Assignment: ${areaName || "New Area"}`,
                    body: notifBody,
                },
            });
        } catch (e) {
            console.error("Notification create error:", e);
        }

        if (manager.pushToken) {
            sendExpoPushNotification({
                pushToken: manager.pushToken,
                title: `📍 ${assigned} New Institutes Assigned`,
                body: notifBody,
                data: { screen: "(sales)/assignments" },
            }).catch(console.error);
        }

        if (manager.email) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://academyfind.com";
            const portalUrl = `${appUrl}/sales_manager/${salesManagerId}`;
            const html = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">
                    <div style="background:#0f766e;padding:16px;border-radius:12px;text-align:center;color:#fff;margin-bottom:20px;">
                        <h2 style="margin:0;">📍 Area Bulk Assignment</h2>
                    </div>
                    <p style="color:#334155;">Hello <strong>${manager.name || "Sales Manager"}</strong>,</p>
                    <p style="color:#475569;">You have been assigned <strong>${assigned} institute${assigned !== 1 ? "s" : ""}</strong> in the area of <strong>${areaName || "a new area"}</strong>.</p>
                    ${deadlineText ? `<p style="color:#475569;">Deadline: <strong>${deadlineText}</strong></p>` : ""}
                    <div style="margin-top:24px;text-align:center;">
                        <a href="${portalUrl}" style="background:#0f172a;color:#fff;padding:12px 24px;font-weight:bold;border-radius:10px;text-decoration:none;">Open Sales Portal →</a>
                    </div>
                </div>
            `;
            sendEmail(manager.email, `📍 ${assigned} Institutes Assigned in ${areaName || "New Area"}`, html).catch(console.error);
        }

        return NextResponse.json({
            success: true,
            assigned,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error("Assign area bulk error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
