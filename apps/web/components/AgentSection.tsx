import { AGENTS } from "@/lib/site";
import { AgentChip } from "./AgentChip";
import { SectionHeading } from "./SectionHeading";

export function AgentSection() {
  return (
    <section id="agents" className="border-t border-white/6 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker="Agents"
          title="Hooks, not another chat window"
          body="Connect the CLIs you already use. Qterm observes terminals and surfaces actions in the UI without taking over your workflow."
        />
        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-3">
          {AGENTS.map((agent) => (
            <AgentChip key={agent.id} name={agent.name} src={agent.src} />
          ))}
        </div>
      </div>
    </section>
  );
}
