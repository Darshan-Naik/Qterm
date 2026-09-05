import type { ReactNode } from "react";
import { GatekeeperPath } from "./GatekeeperPath";
import { GatekeeperTile } from "./GatekeeperTile";
import { MacMiniWindow } from "./MacMiniWindow";

export function GatekeeperGuide() {
  return (
    <div className="mt-4" aria-hidden="true">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <div className="border-b border-white/8 px-2.5 pt-1">
          <GatekeeperPath />
        </div>

        <div className="grid grid-cols-2">
          <div className="border-r border-b border-white/8">
            <GatekeeperTile step={1} title="Drag into Applications">
              <MacMiniWindow>
                <div className="flex h-full items-center justify-center gap-3 px-2">
                  <IconLabel
                    icon={
                      <img
                        src="/icon.svg"
                        alt=""
                        width={30}
                        height={30}
                        className="rounded-[8px] shadow-sm"
                      />
                    }
                    label="Qterm"
                  />
                  <span className="text-[14px] text-zinc-500">→</span>
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
                        <p className="text-[10px] font-semibold leading-tight text-zinc-900">
                          Qterm cannot be opened
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1">
                          <span className="rounded bg-red-100 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-red-600">
                            Don&apos;t
                          </span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400 line-through decoration-red-400">
                            Move to Trash
                          </span>
                          <span className="guide-click rounded bg-[#0a84ff] px-1.5 py-0.5 text-[10px] font-semibold text-white">
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
                  <div className="w-[4.75rem] shrink-0 border-r border-black/8 bg-[#dcdce2] px-1.5 py-1.5">
                    <p className="text-[8px] font-medium uppercase tracking-wider text-zinc-500">
                      Settings
                    </p>
                    <p className="mt-1 rounded bg-white/80 px-1 py-0.5 text-[9px] font-medium leading-tight text-zinc-800">
                      Privacy & Security
                    </p>
                    <p className="mt-0.5 px-1 py-0.5 text-[9px] text-zinc-400">Notifications</p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 px-2 py-1.5">
                    <p className="text-[9px] leading-snug text-zinc-500">
                      Qterm was blocked because it is not from an identified developer.
                    </p>
                    <div className="flex justify-end">
                      <span className="guide-click rounded bg-[#0a84ff] px-1.5 py-0.5 text-[10px] font-semibold text-white">
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
                        width={22}
                        height={22}
                        className="mt-px rounded-[5px]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold leading-tight text-zinc-900">
                          Open Qterm?
                        </p>
                        <div className="mt-1.5 flex justify-end gap-1">
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                            Cancel
                          </span>
                          <span className="guide-click rounded bg-[#0a84ff] px-1.5 py-0.5 text-[10px] font-semibold text-white">
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
    </div>
  );
}

function IconLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-[9px] font-medium text-zinc-600">{label}</span>
    </div>
  );
}

function FolderGlyph() {
  return (
    <span className="flex size-8 items-center justify-center rounded-[8px] bg-[#5ac8fa]/20 text-[#0071e3]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z" />
      </svg>
    </span>
  );
}
