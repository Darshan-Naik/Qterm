import type { ReactNode } from "react";
import { GatekeeperTile } from "./GatekeeperTile";
import { MacMiniWindow } from "./MacMiniWindow";

export function GatekeeperGuide() {
  return (
    <div className="mt-4" aria-hidden="true">
      <div className="mb-3 flex items-center">
        <StepDot n={1} />
        <span className="mx-1.5 h-px flex-1 bg-white/20" />
        <StepDot n={2} />
        <span className="mx-1.5 h-px flex-1 bg-white/20" />
        <StepDot n={3} />
        <span className="mx-1.5 h-px flex-1 bg-white/20" />
        <StepDot n={4} />
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <div className="border-r border-b border-white/8">
          <GatekeeperTile step={1} title="Drag into Applications">
            <MacMiniWindow>
              <div className="flex h-full items-center justify-center gap-3 px-2">
                <IconLabel
                  icon={
                    <img
                      src="/icon.svg"
                      alt=""
                      width={28}
                      height={28}
                      className="rounded-[7px] shadow-sm"
                    />
                  }
                  label="Qterm"
                />
                <span className="text-[13px] text-zinc-500">→</span>
                <IconLabel icon={<FolderGlyph />} label="Applications" />
              </div>
            </MacMiniWindow>
          </GatekeeperTile>
        </div>

        <div className="border-b border-white/8">
          <GatekeeperTile step={2} title="OK, not Move to Trash">
            <MacMiniWindow>
              <div className="flex h-full items-center justify-center px-2 py-1.5">
                <div className="w-full rounded-[10px] bg-white px-2 py-2 shadow-[0_6px_16px_-10px_rgba(0,0,0,0.35)]">
                  <div className="flex gap-1.5">
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ffd60a] text-[11px] font-bold text-black">
                      !
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-semibold leading-tight text-zinc-900">
                        Qterm cannot be opened
                      </p>
                      <div className="mt-1.5 flex items-center justify-end gap-1">
                        <span className="rounded bg-red-100 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-red-600">
                          Don&apos;t
                        </span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] text-zinc-400 line-through decoration-red-400">
                          Move to Trash
                        </span>
                        <span className="guide-click rounded bg-[#0a84ff] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          OK
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </MacMiniWindow>
          </GatekeeperTile>
        </div>

        <div className="border-r border-white/8">
          <GatekeeperTile step={3} title="Privacy & Security">
            <MacMiniWindow>
              <div className="flex h-full">
                <div className="w-[4.6rem] shrink-0 border-r border-black/8 bg-[#dcdce2] px-1.5 py-1.5">
                  <p className="text-[7px] font-medium uppercase tracking-wider text-zinc-500">
                    Settings
                  </p>
                  <p className="mt-1 rounded bg-white/80 px-1 py-0.5 text-[8px] font-medium text-zinc-800">
                    Privacy & Security
                  </p>
                  <p className="mt-0.5 px-1 py-0.5 text-[8px] text-zinc-400">Notifications</p>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between px-2 py-1.5">
                  <p className="text-[8px] leading-snug text-zinc-500">
                    Qterm was blocked because it is not from an identified developer.
                  </p>
                  <div className="flex justify-end">
                    <span className="guide-click rounded bg-[#0a84ff] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      Open Anyway
                    </span>
                  </div>
                </div>
              </div>
            </MacMiniWindow>
          </GatekeeperTile>
        </div>

        <div>
          <GatekeeperTile step={4} title="Open Anyway again">
            <MacMiniWindow>
              <div className="flex h-full items-center justify-center px-2 py-1.5">
                <div className="w-full rounded-[10px] bg-white px-2 py-2 shadow-[0_6px_16px_-10px_rgba(0,0,0,0.35)]">
                  <div className="flex gap-1.5">
                    <img
                      src="/icon.svg"
                      alt=""
                      width={20}
                      height={20}
                      className="mt-px rounded-[5px]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-semibold leading-tight text-zinc-900">
                        Open Qterm?
                      </p>
                      <div className="mt-1.5 flex justify-end gap-1">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] text-zinc-500">
                          Cancel
                        </span>
                        <span className="guide-click rounded bg-[#0a84ff] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          Open Anyway
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </MacMiniWindow>
          </GatekeeperTile>
        </div>
      </div>
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-[11px] font-semibold tabular-nums">
      {n}
    </span>
  );
}

function IconLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-[8px] font-medium text-zinc-600">{label}</span>
    </div>
  );
}

function FolderGlyph() {
  return (
    <span className="flex size-7 items-center justify-center rounded-[7px] bg-[#5ac8fa]/20 text-[#0071e3]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z" />
      </svg>
    </span>
  );
}
