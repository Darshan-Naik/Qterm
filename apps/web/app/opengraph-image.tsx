import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const icon = await readFile(join(process.cwd(), "public/favicon.png"));
  const src = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "#171717",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <img
          src={src}
          width={72}
          height={72}
          alt=""
          style={{ borderRadius: 18, marginBottom: 36 }}
        />
        <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: -2 }}>{SITE.name}</div>
        <div style={{ fontSize: 32, color: "#a3a3a3", marginTop: 12 }}>{SITE.tagline}</div>
      </div>
    ),
    size,
  );
}
