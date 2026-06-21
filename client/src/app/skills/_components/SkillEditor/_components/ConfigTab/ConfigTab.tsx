/* Config tab — name/description/type/body + enabled toggle. When the body is
   dirty an optional "Summary of change" field appears; saving a changed body
   creates a new immutable version. Local state resets when the skill changes. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, TextInput, SelectInput, Textarea, Toggle, Button } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useUpdateSkill } from "../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../lib/toast";
import { TYPE_VALUES } from "./constants";
import { s } from "./styles";

export function ConfigTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();

  const [name, setName] = React.useState(skill.name);
  const [description, setDescription] = React.useState(skill.description);
  const [type, setType] = React.useState<SkillType>(skill.type);
  const [body, setBody] = React.useState(skill.body);
  const [enabled, setEnabled] = React.useState(skill.enabled);
  const [summary, setSummary] = React.useState("");

  // Reset local form when switching skills.
  React.useEffect(() => {
    setName(skill.name);
    setDescription(skill.description);
    setType(skill.type);
    setBody(skill.body);
    setEnabled(skill.enabled);
    setSummary("");
  }, [skill.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bodyDirty = body !== skill.body;

  const typeOptions = TYPE_VALUES.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const save = () =>
    update.mutate(
      {
        id: skill.id,
        patch: {
          name,
          description,
          type,
          body,
          enabled,
          ...(bodyDirty && summary.trim() ? { summary: summary.trim() } : {}),
        },
      },
      {
        onSuccess: (data) => {
          toast.success(t("config.savedToast", { version: data.version }));
          setSummary("");
        },
      },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        <label style={s.enabledLabel}>
          {t("config.enabled")}
          <Toggle on={enabled} onChange={setEnabled} size={16} />
        </label>
      </div>
      <FormField label={t("config.name")} required>
        <TextInput value={name} onChange={setName} mono />
      </FormField>
      <FormField label={t("config.description")} hint={t("config.descriptionHint")}>
        <TextInput value={description} onChange={setDescription} />
      </FormField>
      <FormField label={t("config.type")}>
        <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
      </FormField>
      <FormField label={t("config.body")} hint={t("config.bodyHint")}>
        <Textarea value={body} onChange={setBody} rows={14} mono />
      </FormField>
      {bodyDirty && (
        <FormField label={t("config.summary")} hint={t("config.summaryHint")}>
          <TextInput value={summary} onChange={setSummary} placeholder={t("config.summaryPlaceholder")} />
        </FormField>
      )}
      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={update.isPending}>
          {update.isPending ? t("config.saving") : t("config.save")}
        </Button>
      </div>
    </div>
  );
}
