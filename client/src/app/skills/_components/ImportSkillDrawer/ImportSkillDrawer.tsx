/* Import-skill drawer — pick a Markdown file or zip; the server extracts the
   skill core (no persistence) for preview. Type is editable, body is read-only.
   Saving persists it as source='extracted', enabled=false (vet-before-enable). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Drawer, FormField, SelectInput, Textarea, TextInput } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import {
  useImportSkillPreview,
  useCreateSkill,
  type SkillImportPreview,
} from "../../../../lib/hooks/skills";
import { ApiError } from "../../../../lib/api";
import { ACCEPT, DRAWER_WIDTH, TYPE_VALUES } from "./constants";
import { s } from "./styles";

export function ImportSkillDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const preview = useImportSkillPreview();
  const create = useCreateSkill();

  const [fileName, setFileName] = React.useState<string | null>(null);
  const [extracted, setExtracted] = React.useState<SkillImportPreview | null>(null);
  const [type, setType] = React.useState<SkillType>("custom");
  const [error, setError] = React.useState<string | null>(null);

  const typeOptions = TYPE_VALUES.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setExtracted(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await preview.mutateAsync(form);
      setExtracted(result);
      setType(result.type);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("drawer.importFailed"));
    }
  };

  const save = async () => {
    if (!extracted) return;
    setError(null);
    try {
      const skill = await create.mutateAsync({
        name: extracted.name?.trim() || t("drawer.defaultName"),
        description: extracted.description ?? "",
        type,
        body: extracted.body,
        source: "extracted",
        enabled: false,
      });
      onClose();
      router.push(`/skills/${skill.id}?tab=config`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("drawer.importFailed"));
    }
  };

  return (
    <Drawer
      width={DRAWER_WIDTH}
      title={t("drawer.title")}
      subtitle={t("drawer.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("drawer.cancel")}
          </Button>
          <Button
            kind="primary"
            icon="Check"
            onClick={save}
            disabled={!extracted || create.isPending}
          >
            {create.isPending ? t("drawer.saving") : t("drawer.save")}
          </Button>
        </div>
      }
    >
      <div style={s.picker}>
        <label>
          <input type="file" accept={ACCEPT} onChange={onPick} style={{ display: "none" }} />
          <Button kind="secondary" icon="Upload" disabled={preview.isPending}>
            {preview.isPending ? t("drawer.extracting") : t("drawer.pickFile")}
          </Button>
        </label>
        <span style={s.pickHint}>{t("drawer.pickHint")}</span>
        {fileName && <span style={s.fileName}>{fileName}</span>}
        {error && <span style={s.error}>{error}</span>}
      </div>

      {extracted && (
        <>
          <div style={s.notice}>{t("preview.untrustedNotice")}</div>
          <div style={s.heading}>{t("drawer.previewHeading")}</div>
          <FormField label={t("drawer.name")}>
            <TextInput value={extracted.name ?? ""} mono />
          </FormField>
          <FormField label={t("drawer.description")}>
            <TextInput value={extracted.description ?? ""} />
          </FormField>
          <FormField label={t("drawer.type")}>
            <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
          </FormField>
          <FormField label={t("drawer.body")}>
            <Textarea value={extracted.body} rows={14} mono />
          </FormField>
        </>
      )}
    </Drawer>
  );
}
