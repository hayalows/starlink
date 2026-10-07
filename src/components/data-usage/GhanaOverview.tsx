import type { DishStatusJson } from "@core/dishClient";
import { useGhanaAnalysis } from "../../hooks/useGhanaAnalysis";
import { ghs } from "../../lib/ghanaFormat";
export function GhanaOverview({
  status,
  onOpen,
}: {
  status: DishStatusJson | null;
  onOpen: () => void;
}) {
  const a = useGhanaAnalysis(status);
  return (
    <section
      className='mx-4 mb-4 rounded-2xl border border-hairline bg-card p-4 sm:mx-6'
      aria-label='Ghana cost overview'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-[15px] font-bold'>Your month at a glance</h2>
          <p className='mt-1 text-[11px] text-muted-foreground'>
            {a.energyState.unavailable
              ? "Recorder unavailable · last readings may be stale"
              : a.energy.kWh !== null
                ? "Recording · " + Math.round(a.energy.coverage * 100) + "% energy coverage"
                : "Getting started · add your setup for a cost estimate"}
          </p>
        </div>
        <button
          onClick={onOpen}
          className='min-h-11 rounded-lg bg-foreground px-4 text-[12px] font-semibold text-background focus-visible:ring-2 focus-visible:ring-ring'
        >
          Cost & usage →
        </button>
      </div>
      <div className='mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4'>
        {[
          ["Recorded data", a.usage.gb === null ? "—" : a.usage.gb.toFixed(1) + " GB"],
          ["Cost so far" + (a.settings.planFee > 0 ? "" : " · electricity"), ghs(a.total)],
          ["Effective cost / GB", ghs(a.perGb)],
          ["Month-end cost forecast", ghs(a.projectedTotal)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className='text-[10.5px] text-muted-foreground'>{label}</p>
            <strong className='mt-1 block text-[21px] tabular-nums'>{value}</strong>
          </div>
        ))}
      </div>
      <p className='mt-3 text-[10.5px] text-muted-foreground'>
        Cost includes estimates. Your subscription is fixed; GB use does not directly spend cedis.
        Open the analysis for coverage, budgets and device shares.
      </p>
    </section>
  );
}
