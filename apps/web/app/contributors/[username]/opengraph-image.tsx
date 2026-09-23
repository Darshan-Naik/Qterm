import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { contributorDisplayName, monthYear } from "@/lib/contributor-present.mjs";
import { getContributorData } from "@/lib/contributor-data";
import { findContributor } from "@/lib/contributors";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 43200;
export const runtime = "nodejs";

export default async function ContributorOgImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const data = await getContributorData().catch(() => null);
  const person = data ? findContributor(data, username) : null;
  const name = contributorDisplayName({ name: person?.name, username: person?.username || username });
  const first = !person || person.mergedPRs <= 1;
  const headline = first ? "Welcome to the family" : "Thanks for building Qterm";
  const when = person ? monthYear(person.firstContribution) : "";
  const detail = first ? `First contribution · ${when}` : `Qterm family · since ${when}`;
  const icon = await readFile(join(process.cwd(), "public/favicon.png"));
  const logo = `data:image/png;base64,${icon.toString("base64")}`;

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
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={logo} width={56} height={56} alt="" style={{ borderRadius: 14 }} />
          <div style={{ display: "flex", marginLeft: 16, fontSize: 22, letterSpacing: 6, color: "#8eb4ff" }}>QTERM</div>
        </div>
        <div style={{ display: "flex", marginTop: 72, fontSize: 68, fontWeight: 600 }}>{headline}</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 40 }}>{name}</div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "#b9b5ab" }}>{detail}</div>
        <div style={{ display: "flex", marginTop: 48, fontSize: 30 }}>&quot;I helped build Qterm.&quot;</div>
      </div>
    ),
    { ...size },
  );
}
