import { writeFile, mkdir } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        // Generate a unique filename
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filename = `${timestamp}_${safeName}`;
        const filepath = path.join(uploadsDir, filename);

        // Write the file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // Return the public URL (accessible from the frontend and workflow)
        const url = `/uploads/${filename}`;

        console.log(`[Upload] Saved file: ${filepath}`);
        console.log(`[Upload] Public URL: ${url}`);

        return NextResponse.json({ url, filename, size: buffer.length });
    } catch (error: any) {
        console.error("[Upload] Error:", error);
        return NextResponse.json(
            { error: "Upload failed: " + error.message },
            { status: 500 }
        );
    }
}
