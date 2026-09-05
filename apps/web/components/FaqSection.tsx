import type { FaqItem as FaqItemData } from "@/lib/faq";
import { FaqItem } from "./FaqItem";
import { SectionHeading } from "./SectionHeading";

export function FaqSection({
  items,
  kicker = "FAQ",
  title = "Agent terminal, answered",
  body,
}: {
  items: readonly FaqItemData[];
  kicker?: string;
  title?: string;
  body?: string;
}) {
  return (
    <section id="faq" className="border-t border-white/6 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading kicker={kicker} title={title} body={body} />
        <div className="mx-auto mt-10 max-w-2xl space-y-3">
          {items.map((item) => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}
