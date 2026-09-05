import { MockPane } from "./MockPane";

export function MockSplit() {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 sm:grid-cols-2">
      <MockPane
        title="zsh"
        branch="main"
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
        needsInput
        reveal
        lines={[
          { text: "Inspecting the working tree.", tone: "muted" },
          { text: "On branch main. Working tree is clean.", tone: "fg" },
          { text: "I can add a quieter empty state next.", tone: "dim" },
        ]}
        prompt={{ action: "Edit", path: "src/app/empty-state.tsx" }}
      />
    </div>
  );
}
