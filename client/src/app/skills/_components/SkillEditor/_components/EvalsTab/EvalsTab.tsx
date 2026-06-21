/* Evals tab — empty mount-point. The eval engine arrives in a later lesson;
   this tab makes no data calls. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@devdigest/ui";

export function EvalsTab() {
  const t = useTranslations("skills");
  return <EmptyState icon="FlaskConical" title={t("evals.stub")} />;
}
