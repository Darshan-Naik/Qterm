import { ImageResponse } from "next/og";
import { monthYear } from "@/lib/contributor-present.mjs";
import { findContributor } from "@/lib/contributors";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ContributorOgImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const person = findContributor(username);
  const name = person?.username || username;
  const first = !person || person.mergedPRs <= 1;
  const headline = first ? "Welcome to the family" : "Thanks for building Qterm";
  const when = person ? monthYear(person.firstContribution) : "";
  const detail = first ? `First contribution · ${when}` : `Qterm family · since ${when}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#141413",
          color: "#f3f0e8",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "#8eb4ff" }}>QTERM</div>
        <div style={{ display: "flex", marginTop: 72, fontSize: 68, fontWeight: 600 }}>{headline}</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 40 }}>@{name}</div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "#b9b5ab" }}>{detail}</div>
        <div style={{ display: "flex", marginTop: 48, fontSize: 30 }}>&quot;I helped build Qterm.&quot;</div>
      </div>
    ),
    { ...size },
  );
}
