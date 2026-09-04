import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
        <div
          style={{
            display: "flex",
            width: 72,
            height: 72,
            borderRadius: 18,
            background: "linear-gradient(90deg, rgb(37,99,235), rgb(5,150,105))",
            marginBottom: 36,
          }}
        />
        <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: -2 }}>{SITE.name}</div>
        <div style={{ fontSize: 32, color: "#a3a3a3", marginTop: 12 }}>{SITE.tagline}</div>
      </div>
    ),
    size,
  );
}
