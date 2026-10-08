import { useState } from "react";
import type { DishStatusJson } from "@core/dishClient";
import { useGhanaAnalysis } from "../../hooks/useGhanaAnalysis";
import { useGhanaSettings } from "../../hooks/useGhanaSettings";
import { ghs } from "../../lib/ghanaFormat";
import { ghanaHost } from "../../lib/ghanaHost";
import { BackupRestore } from "./BackupRestore";
import { MonitorUpdates } from "../data-usage/MonitorUpdates";
import { PhoneConnect } from "./PhoneConnect";
export function GhanaHome({
  status,
  connected,
  onCosts,
  onConnection,
}: {
  status: DishStatusJson | null;
  connected: boolean;
  onCosts: () => void;
  onConnection: () => void;
}) {
  const a = useGhanaAnalysis(status, "today");
  const month = useGhanaAnalysis(status, "month");
  const [s, update] = useGhanaSettings();
  const [step, setStep] = useState(
    () => Math.max(0, Number(localStorage.getItem("starlink.ghana.setupStep") ?? 0) || 0) % 3,
  );
  const [showSetup, setShowSetup] = useState(!s.setupDone);
  const [message, setMessage] = useState("");
  function next() {
    try {
      localStorage.setItem("starlink.ghana.setupStep", String(step + 1));
      if (step === 2) {
        update({ setupDone: true });
        setShowSetup(false);
        setMessage("Setup saved. Your monitor is ready.");
      } else setStep(step + 1);
    } catch {
      setMessage("Your browser could not save these settings. Check storage and try again.");
    }
  }
  const save = (patch: Parameters<typeof update>[0]) => {
    try {
      update(patch);
      setMessage("Saved on this device.");
    } catch {
      setMessage("Could not save. Check browser storage and try again.");
    }
  };
  const recorded = connected && !a.stale && a.energy.latest > 0;
  const statusText = !connected
    ? "Waiting for your Starlink connection"
    : recorded
      ? "Your monitor is recording"
      : a.energy.latest
        ? "Last readings may be stale"
        : "Connected · building your history";
  return (
    <div className='ghana-stack'>
      <section className='ghana-section ghana-hero'>
        <div className='ghana-split'>
          <div>
            <p className='ghana-eyebrow'>YOUR STARLINK · GHANA</p>
            <h1>Your internet today</h1>
            <p role='status'>{statusText}</p>
          </div>
          <button className='ghana-button' onClick={onConnection}>
            Check connection
          </button>
        </div>
        <p className='ghana-muted'>
          {a.energy.latest
            ? `Last recorded ${new Date(a.energy.latest * 1000).toLocaleTimeString("en-GH", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" })} · ${Math.round(a.energy.coverage * 100)}% of today recorded.`
            : "Keep Chrome open on your Starlink Wi-Fi to collect readings. The website calculator has separate settings."}
        </p>
        <div className='ghana-metrics'>
          <div>
            <span>Data recorded today</span>
            <strong>
              {a.loading ? "…" : a.usage.gb === null ? "—" : a.usage.gb.toFixed(2) + " GB"}
            </strong>
            <small>Download + upload · recorded time only</small>
          </div>
          <div>
            <span>Estimated cost today</span>
            <strong>{a.loading ? "…" : ghs(a.total)}</strong>
            <small>Plan time share + electricity estimate</small>
          </div>
          <div>
            <span>Estimated month-end cost</span>
            <strong>{ghs(month.projectedTotal)}</strong>
            <small>
              {s.planFee
                ? `Includes your ${ghs(s.planFee)} plan`
                : "Add your plan fee for a combined estimate"}
            </small>
          </div>
        </div>
        <button className='ghana-button ghana-primary' onClick={onCosts}>
          Understand my costs
        </button>
      </section>
      <section className='ghana-section'>
        <h2>What needs your attention?</h2>
        {!connected ? (
          <p>
            Connect this computer to your Starlink Wi-Fi. A missing connection alone does not tell
            us whether the dish lost power.
          </p>
        ) : a.stale ? (
          <p>
            Your last readings are saved, but recording may have stopped. Open Connection to check
            the dish and recorder.
          </p>
        ) : !s.planFee ? (
          <p>Add the monthly fee from your bill to see your full internet cost.</p>
        ) : month.projectedTotal !== null &&
          s.costBudget > 0 &&
          month.projectedTotal > s.costBudget ? (
          <p>
            Your forecast is {ghs(month.projectedTotal - s.costBudget)} above your spending target.
            Review your electricity assumptions and fixed plan fee under Costs.
          </p>
        ) : (
          <p>
            No spending warning from your current settings. Your plan fee stays fixed as you use
            data.
          </p>
        )}
        <div className='ghana-split'>
          <span>Today versus yesterday, at the same time</span>
          <strong>
            {a.change === null
              ? "More comparable history needed"
              : `${Math.abs(a.change).toFixed(0)}% ${a.change >= 0 ? "more" : "less"} data`}
          </strong>
        </div>
        <p className='ghana-muted'>
          Comparisons need at least 80% coverage in both periods and similar coverage. Gaps are
          never counted as zero use.
        </p>
      </section>
      <section className='ghana-section'>
        <div className='ghana-split'>
          <h2>{s.setupDone ? "Your setup" : "Let’s personalise your monitor"}</h2>
          <button
            className='ghana-button'
            onClick={() => {
              setShowSetup(!showSetup);
              setStep(0);
            }}
          >
            {showSetup ? "Do this later" : "Edit setup"}
          </button>
        </div>
        {showSetup && (
          <div className='ghana-stack'>
            <p className='ghana-eyebrow'>
              Step {step + 1} of 3 · {["Dish & connection", "Your plan", "Targets & alerts"][step]}
            </p>
            {step === 0 && (
              <>
                <p>
                  {connected
                    ? "Dish connection detected."
                    : "You can set up now and connect to your dish later."}{" "}
                  Choose a model if automatic detection is unavailable.
                </p>
                <label className='ghana-label'>
                  Dish model
                  <select
                    className='ghana-input'
                    value={s.model}
                    onChange={(e) => save({ model: e.target.value as typeof s.model })}
                  >
                    <option value='auto'>Auto-detect {a.model ? `(${a.model})` : ""}</option>
                    <option value='mini'>Starlink Mini</option>
                    <option value='standard4'>Standard Gen 4</option>
                    <option value='standard5'>Standard Gen 5</option>
                    <option value='custom'>Custom watts (edit in Costs)</option>
                  </select>
                </label>
                <p className='ghana-muted'>
                  Model power estimates are labelled. Recorded energy takes over when available.
                </p>
              </>
            )}
            {step === 1 && (
              <div className='ghana-form'>
                <label className='ghana-label'>
                  Monthly plan fee · GH₵
                  <input
                    className='ghana-input'
                    type='number'
                    min='0'
                    max='100000'
                    step='0.01'
                    value={s.planFee}
                    onChange={(e) => save({ planFee: Number(e.target.value) })}
                  />
                </label>
                <label className='ghana-label'>
                  Billing starts on day
                  <input
                    className='ghana-input'
                    type='number'
                    min='1'
                    max='31'
                    value={s.billingDay}
                    onChange={(e) => save({ billingDay: Number(e.target.value) })}
                  />
                </label>
                <p className='ghana-muted'>
                  Use your own bill. Leave the fee at zero for electricity-only estimates. Short
                  months use their last day when needed. Advanced tariff settings are under Costs.
                </p>
              </div>
            )}
            {step === 2 && (
              <>
                <div className='ghana-form'>
                  <label className='ghana-label'>
                    Monthly spending target · GH₵
                    <input
                      className='ghana-input'
                      type='number'
                      min='0'
                      value={s.costBudget}
                      onChange={(e) => save({ costBudget: Number(e.target.value) })}
                    />
                  </label>
                  <label className='ghana-label'>
                    Monthly data target · GB
                    <input
                      className='ghana-input'
                      type='number'
                      min='0'
                      value={s.dataBudget}
                      onChange={(e) => save({ dataBudget: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <p className='ghana-muted'>
                  Zero turns a target off. Targets use calendar months. No internet limits are
                  imposed.
                </p>
              </>
            )}
            <div className='ghana-actions'>
              {step > 0 && (
                <button className='ghana-button' onClick={() => setStep(step - 1)}>
                  Back
                </button>
              )}
              <button className='ghana-button ghana-primary' onClick={next}>
                {step === 2 ? "Finish setup" : "Save & continue"}
              </button>
            </div>
          </div>
        )}
      </section>
      <details className='ghana-section'>
        <summary>Budget notifications & quiet hours</summary>
        <p>
          Optional alerts at 80% and 100% of a calendar-month target. At most one alert every six
          hours, with each threshold announced once per month. Chrome must be running.
        </p>
        <label className='ghana-check'>
          <input
            type='checkbox'
            checked={s.budgetAlerts}
            disabled={!ghanaHost()}
            onChange={(e) => save({ budgetAlerts: e.target.checked })}
          />{" "}
          Notify me about my budget
        </label>
        <div className='ghana-form'>
          <label className='ghana-label'>
            Quiet hours start (Ghana, 0–23)
            <input
              className='ghana-input'
              type='number'
              min='0'
              max='23'
              value={s.quietStart}
              onChange={(e) => save({ quietStart: Number(e.target.value) })}
            />
          </label>
          <label className='ghana-label'>
            Quiet hours end (Ghana, 0–23)
            <input
              className='ghana-input'
              type='number'
              min='0'
              max='23'
              value={s.quietEnd}
              onChange={(e) => save({ quietEnd: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className='ghana-muted'>
          Matching start/end hours means no quiet period. Also enable browser notifications using
          the bell in the top bar. Spending alerts use recorded electricity plus your plan’s time
          share; incomplete history can delay alerts.
        </p>
      </details>
      <p role='status'>{message}</p>
      <PhoneConnect />
      <BackupRestore />
      <MonitorUpdates />
    </div>
  );
}
