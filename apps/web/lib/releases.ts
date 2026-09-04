import { MAC_ASSET, SITE } from "./site";

export type MacDownloads = {
  version: string | null;
  arm64: string;
  amd64: string | null;
};

type GithubAsset = {
  name: string;
  browser_download_url: string;
};

type GithubRelease = {
  tag_name?: string;
  html_url?: string;
  assets?: GithubAsset[];
};

export function latestDownloadUrl(filename: string) {
  return `${SITE.github}/releases/latest/download/${filename}`;
}

export function pickMacDownloads(release: GithubRelease | null): MacDownloads {
  const assets = release?.assets ?? [];
  const arm64 =
    assets.find((a) => a.name === MAC_ASSET.arm64)?.browser_download_url ??
    assets.find((a) => /-arm64\.dmg$/i.test(a.name))?.browser_download_url ??
    latestDownloadUrl(MAC_ASSET.arm64);
  const amd64 =
    assets.find((a) => a.name === MAC_ASSET.amd64)?.browser_download_url ??
    assets.find((a) => /-amd64\.dmg$/i.test(a.name))?.browser_download_url ??
    null;
  const tag = release?.tag_name?.replace(/^v/, "") ?? null;
  return { version: tag, arm64, amd64 };
}

export async function getMacDownloads(): Promise<MacDownloads> {
  const fallback = pickMacDownloads(null);
  try {
    const res = await fetch(`https://api.github.com/repos/${SITE.repo}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "qterm-web",
      },
      next: { revalidate: 120 },
    });
    if (res.status === 404) {
      return { version: null, arm64: SITE.releases, amd64: null };
    }
    if (!res.ok) return fallback;
    const data = (await res.json()) as GithubRelease;
    return pickMacDownloads(data);
  } catch {
    return fallback;
  }
}
