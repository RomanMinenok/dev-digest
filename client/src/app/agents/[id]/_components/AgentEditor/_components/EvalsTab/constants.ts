/** i18n key → metric field mapping for the three eval metric cards. */
export const METRIC_CARDS = [
  { labelKey: "dashboard.metrics.recall",          field: "recall"            },
  { labelKey: "dashboard.metrics.precision",        field: "precision"         },
  { labelKey: "dashboard.metrics.citationAccuracy", field: "citation_accuracy" },
] as const satisfies ReadonlyArray<{ labelKey: string; field: string }>;

export type MetricField = (typeof METRIC_CARDS)[number]["field"];
