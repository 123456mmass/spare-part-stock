import QRCode from "qrcode";
import path from "path";
import fs from "fs/promises";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const QR_DIR = path.join(UPLOADS_DIR, "qrcodes");

export async function ensureQRDIR() {
  try {
    await fs.mkdir(QR_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

export async function generateQRCode(partId: string, partNumber: string): Promise<string> {
  await ensureQRDIR();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qrContent = `${appUrl}/parts/${partId}`;

  const fileName = `${partNumber.replace(/[^a-zA-Z0-9]/g, "_")}_qr.png`;
  const filePath = path.join(QR_DIR, fileName);
  const publicPath = `/uploads/qrcodes/${fileName}`;

  try {
    await fs.access(filePath);
    return publicPath;
  } catch {
    // File doesn't exist, generate it
  }

  await QRCode.toFile(filePath, qrContent, {
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  return publicPath;
}

export async function generateQRCodeDataURL(partId: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qrContent = `${appUrl}/parts/${partId}`;

  return QRCode.toDataURL(qrContent, {
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}
