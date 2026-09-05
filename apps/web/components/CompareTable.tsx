import { COMPARE_ROWS } from "@/lib/compare";

const COLUMNS = [
  { key: "qterm" as const, label: "Qterm" },
  { key: "warp" as const, label: "Warp" },
  { key: "ghostty" as const, label: "Ghostty" },
  { key: "iterm" as const, label: "iTerm2" },
  { key: "cmux" as const, label: "cmux" },
];

export function CompareTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        <thead className="bg-white/4 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Feature</th>
            {COLUMNS.map((column) => (
              <th key={column.key} className="px-4 py-3 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((row) => (
            <tr key={row.feature} className="border-t border-white/6">
              <th className="px-4 py-3 font-medium text-foreground">{row.feature}</th>
              {COLUMNS.map((column) => (
                <td key={column.key} className="px-4 py-3 text-muted-foreground">
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
