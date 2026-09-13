"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const PALETTE = ["#7133ab", "#f2760a", "#4a2373", "#ff9433", "#5c2c8f", "#c0293a", "#1a8f5e"];

export function MonthlyDisbursementChart({
  data,
  schemeKeys,
}: {
  data: Record<string, number | string>[];
  schemeKeys: { key: string; label: string }[];
}) {
  const hasData = data.some((row) => schemeKeys.some((s) => Number(row[s.key] || 0) > 0));
  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[220px] text-xs text-[var(--gt-muted)]">
        No disbursement schedule data available.
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -10, right: 10, top: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3ddec" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}Cr`} />
          <Tooltip formatter={(v) => [`₹${v} Cr`, ""]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {schemeKeys.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === schemeKeys.length - 1 ? [4, 4, 0, 0] : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
