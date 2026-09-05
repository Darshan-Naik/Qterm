import { MockPane } from "./MockPane";

export function MockSplit({ claude }: { claude: "thinking" | "input" }) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 sm:grid-cols-2">
      <MockPane
        title="zsh"
        branch="main"
        active
        lines={[
          { text: "~/acme % git status", tone: "muted" },
          { text: "On branch main", tone: "fg" },
          { text: "nothing to commit, working tree clean", tone: "fg" },
        ]}
        caret
      />
      <MockPane
        title="claude"
        agent="claude"
        branch="main"
        thinking={claude === "thinking"}
        needsInput={claude === "input"}
        reveal
        lines={[
          { text: "Inspecting the working tree.", tone: "muted" },
          { text: "On branch main. Working tree is clean.", tone: "fg" },
          { text: "I can add a quieter empty state next.", tone: "dim" },
        ]}
        working={claude === "thinking"}
        prompt={claude === "input" ? { action: "Edit", path: "src/app/empty-state.tsx" } : undefined}
      />
    </div>
  );
}
