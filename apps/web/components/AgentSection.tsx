import Link from "next/link";
import { AGENTS } from "@/lib/site";
import { AgentChip } from "./AgentChip";
import { SectionHeading } from "./SectionHeading";

export function AgentSection() {
  return (
    <section id="agents" className="border-t border-white/6 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker="Agents"
          title="Agents, not another chat window"
          body="Bring the agents you already use. They stay in the terminal. Qterm never takes over your workflow."
        />
        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-3">
          {AGENTS.map((agent) => (
            <Link key={agent.id} href={`/agents/${agent.slug}`}>
              <AgentChip name={agent.name} src={agent.src} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
