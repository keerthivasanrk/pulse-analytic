"use client";

import { usePulseStore } from "@/lib/store";

const CAMPAIGNS = [
  { id: "", label: "All Campaigns" },
  { id: "camp-001", label: "Summer Blaze AR" },
  { id: "camp-002", label: "Holiday Interactive" },
  { id: "camp-003", label: "Spring Launch Video" },
  { id: "camp-004", label: "Brand Awareness QR" },
  { id: "camp-005", label: "Festive Commerce 360" },
];

const DEVICE_TYPES = ["", "mobile", "desktop", "tablet"];
const CHANNELS = ["", "social", "sms", "email", "web", "qr"];
const CREATIVE_TYPES = ["", "video", "interactive", "ar", "static"];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          h-8 px-2.5 rounded-md text-[13px] text-zinc-300
          bg-zinc-900 border border-white/[0.06]
          outline-none cursor-pointer
          focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10
          transition-all duration-150
          appearance-none
        "
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%2352525b' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundPosition: "right 8px center",
          backgroundRepeat: "no-repeat",
          paddingRight: "28px",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function FilterBar() {
  const filters = usePulseStore((s) => s.filters);
  const setFilter = usePulseStore((s) => s.setFilter);
  const clearFilters = usePulseStore((s) => s.clearFilters);

  const hasFilters = Object.values(filters).some((v) => v);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Campaign"
        value={filters.campaignId || ""}
        options={CAMPAIGNS.map((c) => ({ value: c.id, label: c.label }))}
        onChange={(v) => setFilter("campaignId", v || undefined)}
      />
      <Select
        label="Device"
        value={filters.deviceType || ""}
        options={DEVICE_TYPES.map((d) => ({ value: d, label: d || "All" }))}
        onChange={(v) => setFilter("deviceType", v || undefined)}
      />
      <Select
        label="Channel"
        value={filters.channel || ""}
        options={CHANNELS.map((c) => ({ value: c, label: c || "All" }))}
        onChange={(v) => setFilter("channel", v || undefined)}
      />
      <Select
        label="Creative"
        value={filters.creativeType || ""}
        options={CREATIVE_TYPES.map((c) => ({ value: c, label: c || "All" }))}
        onChange={(v) => setFilter("creativeType", v || undefined)}
      />

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="h-8 px-3 rounded-md text-[12px] font-medium text-zinc-500 hover:text-zinc-300 border border-white/[0.06] hover:border-white/[0.1] transition-all duration-150"
        >
          Clear
        </button>
      )}
    </div>
  );
}
