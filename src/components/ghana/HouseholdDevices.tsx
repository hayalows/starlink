import { useState } from "react";
import { useClientTotals } from "../../hooks/useClientTotals";
import { usageKey } from "@core/clientUsage";
import { useDeviceProfiles, saveProfiles } from "../../lib/ghanaProfiles";
import { ghs } from "../../lib/ghanaFormat";
import { useGhanaAnalysis } from "../../hooks/useGhanaAnalysis";
import type { DishStatusJson } from "@core/dishClient";
export function HouseholdDevices({ status }: { status: DishStatusJson | null }) {
  const { totals, unavailable } = useClientTotals();
  const profiles = useDeviceProfiles();
  const a = useGhanaAnalysis(status);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState(""),
    [group, setGroup] = useState(""),
    [message, setMessage] = useState("");
  const now = new Date();
  const month = now.getFullYear() * 12 + now.getMonth();
  const rows = (totals ?? [])
    .map((t) => {
      const key = usageKey(t.clientId, t.macAddress),
        p = profiles[key],
        date = new Date(t.sinceMs);
      return {
        ...t,
        key,
        label: p?.name || t.name || t.macAddress,
        group: p?.group || "Unassigned",
        bytes: date.getFullYear() * 12 + date.getMonth() === month ? t.rxBytes + t.txBytes : 0,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const total = rows.reduce((n, t) => n + t.bytes, 0);
  const groups = Object.entries(
    rows.reduce<Record<string, number>>((acc, t) => {
      acc[t.group] = (acc[t.group] ?? 0) + t.bytes;
      return acc;
    }, Object.create(null)),
  ).sort((a, b) => b[1] - a[1]);
  return (
    <section className='ghana-section'>
      <h2>Your household devices</h2>
      <p className='ghana-muted'>
        Give each device a familiar name and a person or room. If you connect your phone, these
        labels are included in your private encrypted-transport summaries; MAC addresses are never
        sent. Router names and access rules are managed in Advanced → Network.
      </p>
      <label className='ghana-label'>
        Find a device
        <input
          className='ghana-input'
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Name, person, room or device address'
        />
      </label>
      {unavailable ? (
        <p role='status'>
          The recorder is unavailable. Showing the last device list where available.
        </p>
      ) : totals === null ? (
        <p role='status'>Loading your devices…</p>
      ) : rows.length === 0 ? (
        <p>
          No device history yet. Keep Chrome open on your Starlink Wi-Fi. Devices appear after the
          router reports them.
        </p>
      ) : null}
      {rows
        .filter((t) =>
          [t.label, t.group, t.macAddress].join(" ").toLowerCase().includes(query.toLowerCase()),
        )
        .map((t) => (
          <article className='ghana-device' key={t.key}>
            <div>
              <strong>{t.label}</strong>
              <p className='ghana-muted'>
                {t.group} · {(t.bytes / 1e9).toFixed(2)} GB this calendar month ·{" "}
                {total ? Math.round((t.bytes / total) * 100) : 0}% of tracked traffic
              </p>
            </div>
            <button
              className='ghana-button'
              onClick={() => {
                setEditing(t.key);
                setName(profiles[t.key]?.name ?? t.name ?? "");
                setGroup(profiles[t.key]?.group ?? "");
                setMessage("");
              }}
            >
              Edit name & group
            </button>
            {editing === t.key && (
              <form
                className='ghana-form'
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    saveProfiles({
                      ...profiles,
                      [t.key]: { name: name.trim(), group: group.trim() },
                    });
                    setEditing(null);
                    setMessage("Device details saved.");
                  } catch {
                    setMessage("Could not save. Check browser storage and try again.");
                  }
                }}
              >
                <label className='ghana-label'>
                  Display name
                  <input
                    autoFocus
                    className='ghana-input'
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className='ghana-label'>
                  Person or room
                  <input
                    className='ghana-input'
                    maxLength={60}
                    list='ghana-groups'
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    placeholder='For example, Papa Kojo'
                  />
                </label>
                <button className='ghana-button ghana-primary' type='submit'>
                  Save device
                </button>
                <button className='ghana-button' type='button' onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </form>
            )}
          </article>
        ))}
      {rows.length > 0 &&
        !rows.some((t) =>
          [t.label, t.group, t.macAddress].join(" ").toLowerCase().includes(query.toLowerCase()),
        ) && <p>No matching devices. Try a shorter name or clear the search.</p>}
      <datalist id='ghana-groups'>
        {groups
          .filter(([g]) => g !== "Unassigned")
          .map(([g]) => (
            <option key={g} value={g} />
          ))}
      </datalist>
      <p role='status'>{message}</p>
      {total > 0 && (
        <div className='ghana-section ghana-inset'>
          <h3>Usage by person or room</h3>
          <p className='ghana-muted'>
            Calendar-month router traffic. Cost shares allocate the estimated full-month bill by
            traffic; they are not charges or measured electricity per person.
          </p>
          {groups.map(([g, bytes]) => (
            <div className='ghana-split' key={g}>
              <span>{g}</span>
              <strong>
                {(bytes / 1e9).toFixed(2)} GB ·{" "}
                {ghs(a.projectedTotal === null ? null : (a.projectedTotal * bytes) / total)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
