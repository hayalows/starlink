/**
 * Describe the evidence behind a month-end forecast without pretending that
 * a few recorded hours constitute a complete month.
 */
export function forecastQuality(sampledSeconds: number, elapsedCoverage: number) {
  const hours = Math.max(0, sampledSeconds) / 3600;
  const coverage = Math.max(0, Math.min(1, elapsedCoverage));
  if (hours < 24) {
    return {
      level: "insufficient" as const,
      label: "Not enough history",
      explanation: "At least 24 recorded hours are needed for a usage forecast.",
      hours,
    };
  }
  if (hours < 72 || coverage < 0.5) {
    return {
      level: "early" as const,
      label: "Early estimate",
      explanation: "Only a small sample is recorded. The forecast may change considerably.",
      hours,
    };
  }
  if (hours < 168 || coverage < 0.8) {
    return {
      level: "developing" as const,
      label: "Developing estimate",
      explanation:
        "More recording time, including busy and quiet days, will improve this forecast.",
      hours,
    };
  }
  return {
    level: "supported" as const,
    label: "Better supported estimate",
    explanation: "Several days were recorded with good coverage. This is still a projection.",
    hours,
  };
}
