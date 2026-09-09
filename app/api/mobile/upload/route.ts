import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let dataUri = "";
    let fileType = "image";
    let fileName = "file";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      dataUri = body.base64 || body.dataUri || body.file || "";
      fileType = body.type || "image";
      fileName = body.fileName || "upload";

      if (!dataUri) {
        return NextResponse.json(
          { success: false, error: "No base64 file data provided" },
          { status: 400 }
        );
      }

      // Ensure proper data URI prefix
      if (!dataUri.startsWith("data:")) {
        const mime = body.mimeType || (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
        dataUri = `data:${mime};base64,${dataUri}`;
      }
    } else {
      const formData = await request.formData();
      const file = (formData.get("file") || formData.get("image") || formData.get("document")) as File | null;
      fileType = (formData.get("type") as string) || "image";

      if (!file || typeof file === "string" || file.size === 0) {
        return NextResponse.json(
          { success: false, error: "No file provided" },
          { status: 400 }
        );
      }

      fileName = file.name || "upload";
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
    }

    const isPdfOrDoc =
      dataUri.startsWith("data:application/pdf") ||
      fileName.toLowerCase().endsWith(".pdf") ||
      fileName.toLowerCase().endsWith(".doc") ||
      fileName.toLowerCase().endsWith(".docx");

    const folder = isPdfOrDoc
      ? "academyfind/brochures"
      : fileType === "cover"
      ? "academyfind/banners"
      : "academyfind/institutes";

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: isPdfOrDoc ? "auto" : "image",
      public_id: `${fileType}-${Date.now()}`,
      overwrite: true,
      ...(isPdfOrDoc ? {} : { format: "webp" }),
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      originalFilename: fileName,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
    });
  } catch (error: any) {
    console.error("Mobile universal file upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
