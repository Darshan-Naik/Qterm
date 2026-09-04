import { MockPane } from "./MockPane";

export function MockSplit() {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 sm:grid-cols-2">
      <MockPane
        title="dev"
        lines={[
          { text: "~/acme % git status", tone: "muted" },
          { text: "On branch main", tone: "fg" },
          { text: "nothing to commit, working tree clean", tone: "fg" },
        ]}
        caret
      />
      <MockPane
        title="claude"
        lines={[
          { text: "Looking at the repo…", tone: "muted" },
          { text: "Working tree is clean.", tone: "fg" },
          { text: "Ready for the next change.", tone: "dim" },
        ]}
      />
    </div>
  );
}
