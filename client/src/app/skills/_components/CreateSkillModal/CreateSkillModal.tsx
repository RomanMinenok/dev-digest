/* Create-skill modal — name/description/type/body. Creates a manual, enabled
   skill and navigates to its Config tab. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Modal, FormField, TextInput, SelectInput, Textarea } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { useCreateSkill } from "../../../../lib/hooks/skills";
import { DEFAULT_TYPE, MODAL_WIDTH, TYPE_VALUES } from "./constants";
import { s } from "./styles";

interface InitialValues {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
}

export function CreateSkillModal({
  onClose,
  initialValues,
}: {
  onClose: () => void;
  initialValues?: InitialValues;
}) {
  const t = useTranslations("skills");
  const router = useRouter();
  const create = useCreateSkill();
  const [name, setName] = React.useState(initialValues?.name ?? "");
  const [description, setDescription] = React.useState(initialValues?.description ?? "");
  const [type, setType] = React.useState<SkillType>(initialValues?.type ?? DEFAULT_TYPE);
  const [body, setBody] = React.useState(initialValues?.body ?? "");

  const typeOptions = TYPE_VALUES.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const submit = async () => {
    const skill = await create.mutateAsync({
      name: name.trim() || t("create.defaultName"),
      description,
      type,
      body,
      source: "manual",
      enabled: true,
    });
    onClose();
    router.push(`/skills/${skill.id}?tab=config`);
  };

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Plus" onClick={submit} disabled={create.isPending}>
            {create.isPending ? t("create.creating") : t("create.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("create.name")} required>
          <TextInput value={name} onChange={setName} placeholder={t("create.namePlaceholder")} mono />
        </FormField>
        <FormField label={t("create.description")} hint={t("config.descriptionHint")}>
          <TextInput
            value={description}
            onChange={setDescription}
            placeholder={t("create.descriptionPlaceholder")}
          />
        </FormField>
        <FormField label={t("create.type")}>
          <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
        </FormField>
        <FormField label={t("create.body")}>
          <Textarea value={body} onChange={setBody} rows={10} mono placeholder={t("create.bodyPlaceholder")} />
        </FormField>
      </div>
    </Modal>
  );
}
