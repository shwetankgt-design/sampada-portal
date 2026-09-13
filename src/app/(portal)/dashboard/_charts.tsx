"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

const PALETTE = ["#7133ab", "#f2760a", "#4a2373", "#ff9433", "#5c2c8f", "#c0293a", "#1a8f5e", "#b3760a"];

export function StatusFunnel({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e3ddec" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis dataKey="stage" type="category" width={90} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#7133ab" radius={[0, 6, 6, 0]} barSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  const nonZero = data.filter((d) => d.value > 0);
  if (nonZero.length === 0) {
    return <EmptyChart />;
  }
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={nonZero}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {nonZero.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VerticalBarChart({
  data,
  dataKey = "value",
  color = "#7133ab",
}: {
  data: { name: string; value: number }[];
  dataKey?: string;
  color?: string;
}) {
  if (data.every((d) => d.value === 0)) return <EmptyChart />;
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -10, right: 10, top: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3ddec" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizontalBarChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0 || data.every((d) => d.value === 0)) return <EmptyChart />;
  return (
    <div style={{ width: "100%", height: Math.max(180, data.length * 32) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e3ddec" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#f2760a" radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLineChart({ data }: { data: { month: string; count: number }[] }) {
  if (data.every((d) => d.count === 0)) return <EmptyChart />;
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: -10, right: 15, top: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3ddec" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#7133ab" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[200px] text-xs text-[var(--gt-muted)]">
      No data available for this filter.
    </div>
  );
}
