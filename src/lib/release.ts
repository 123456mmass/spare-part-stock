import { promises as fs } from "fs";
import path from "path";

const RELEASE_DIR = path.join(process.cwd(), "public", "apk");
const APK_FILE = "sparepart_mobile.apk";
const VERSION_FILE = "version.json";

export interface ReleaseInfo {
  version: string;
  buildNumber: string;
  filename: string;
  buildDate: string;
  sizeBytes: number;
}

async function versionPath(): Promise<string> {
  return path.join(RELEASE_DIR, VERSION_FILE);
}

async function apkPath(): Promise<string> {
  return path.join(RELEASE_DIR, APK_FILE);
}

async function apkExists(): Promise<boolean> {
  try {
    await fs.access(await apkPath());
    return true;
  } catch {
    return false;
  }
}

export async function readReleaseInfo(): Promise<ReleaseInfo | null> {
  try {
    const raw = await fs.readFile(await versionPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ReleaseInfo>;
    if (!parsed.version) return null;
    return {
      version: parsed.version ?? "1.0.0",
      buildNumber: parsed.buildNumber ?? "1",
      filename: parsed.filename ?? APK_FILE,
      buildDate: parsed.buildDate ?? "",
      sizeBytes: parsed.sizeBytes ?? 0,
    };
  } catch {
    return null;
  }
}

export async function existsReleaseApk(): Promise<boolean> {
  return apkExists();
}

export async function readReleaseApk(): Promise<Buffer | null> {
  if (!(await apkExists())) return null;
  return fs.readFile(await apkPath());
}
