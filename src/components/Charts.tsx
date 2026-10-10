"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const COLORS = {
  gold: "#eed587",
  green: "#6ccf94",
  blue: "#7ea6f8",
  purple: "#d49cf2",
  orange: "#f0a67a",
  cyan: "#8de6e6",
  red: "#ec7a7a",
  lime: "#b5e55c",
};
const PALETTE = Object.values(COLORS);

const tooltipStyle = {
  contentStyle: {
    background: "#12141a",
    border: "1px solid #2a2d36",
    borderRadius: 10,
    fontSize: 13,
  },
  labelStyle: { color: "#e8eaf0" },
};

export function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#23262e] bg-[#181a20] p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-100">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ text = "ยังไม่มีข้อมูล" }: { text?: string }) {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-slate-500">
      {text}
    </div>
  );
}

/** กราฟเส้นยอดขายรายวัน เงินสด vs QR */
export function DailyLineChart({
  data,
}: {
  data: { date: string; cash: number; qr: number }[];
}) {
  return (
    <div className="h-[330px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d36" />
          <XAxis
            dataKey="date"
            stroke="#8b90a0"
            fontSize={13}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis stroke="#8b90a0" fontSize={13} allowDecimals={false} />
          <Tooltip {...tooltipStyle} />
          <Legend />
          <Line
            type="monotone"
            dataKey="cash"
            name="เงินสด"
            stroke={COLORS.green}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="qr"
            name="QR"
            stroke={COLORS.blue}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type PieLabelProps = {
  x?: number;
  y?: number;
  value?: number;
  fill?: string;
  textAnchor?: "start" | "middle" | "end" | "inherit";
};

/** กราฟวงกลม ตัวเลขอยู่นอกวง สีเดียวกับชิ้นนั้น */
export function ColoredPie({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors?: string[];
}) {
  const palette = colors ?? PALETTE;
  if (!data.some((d) => d.value > 0)) return <Empty />;
  return (
    <div className="h-[330px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius="62%"
            stroke="#e8eaf0"
            strokeWidth={0.5}
            label={(p: PieLabelProps) => (
              <text
                x={p.x}
                y={p.y}
                fill={p.fill}
                textAnchor={p.textAnchor}
                dominantBaseline="central"
                fontSize={16}
              >
                {p.value}
              </text>
            )}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** กราฟแท่งแนวนอน แต่ละแท่งสีต่างกัน */
export function HBarChart({
  data,
  emptyText,
}: {
  data: { name: string; value: number }[];
  emptyText?: string;
}) {
  if (!data.some((d) => d.value > 0)) return <Empty text={emptyText} />;
  const height = Math.max(200, data.length * 40 + 50);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d36" />
          <XAxis type="number" stroke="#8b90a0" fontSize={12} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#8b90a0"
            fontSize={13}
            width={90}
          />
          <Tooltip {...tooltipStyle} cursor={{ fill: "#ffffff0d" }} />
          <Bar dataKey="value" name="จำนวน" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
