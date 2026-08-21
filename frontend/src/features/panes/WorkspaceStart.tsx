import { WorkspaceActions } from "./WorkspaceActions";

/** Centered start screen when there are no projects and no terminals. */
export function WorkspaceStart() {
  return (
    <div className="flex max-w-sm flex-col items-center gap-5 text-center">
      <div className="space-y-1.5">
        <p className="text-[17px] font-medium tracking-tight text-muted-foreground">Get started</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground/70">
          Open a terminal, or add a project folder to organize your work.
        </p>
      </div>
      <WorkspaceActions />
    </div>
  );
}
