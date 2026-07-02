/* Preview tab — renders the skill body exactly as the reviewing agent receives
   it, as Markdown inside a Card. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { s } from "./styles";

export function PreviewTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("preview.title")}</h2>
      <p style={s.subtitle}>{t("preview.subtitle")}</p>
      <Card>
        <Markdown>{skill.body}</Markdown>
      </Card>
    </div>
  );
}
