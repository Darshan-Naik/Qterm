import { MockPane } from "./MockPane";

export function MockSplit() {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 sm:grid-cols-2">
      <MockPane
        title="dev"
        lines={[
          { text: "~/qterm % git status", tone: "muted" },
          { text: "On branch main", tone: "fg" },
          { text: "nothing to commit, working tree clean", tone: "fg" },
          { text: "~/qterm % wails dev", tone: "muted" },
          { text: "Watching for changes…", tone: "dim" },
        ]}
        caret
      />
      <MockPane
        title="claude"
        lines={[
          { text: "claude · resume 7f2a", tone: "muted" },
          { text: "Connected. Reading git status…", tone: "fg" },
          { text: "Ready for the next change.", tone: "dim" },
        ]}
      />
    </div>
  );
}
