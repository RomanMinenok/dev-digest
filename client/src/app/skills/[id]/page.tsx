/* /skills/:id — Skills Lab master-detail with a skill selected. Tab state lives
   in ?tab= (config|preview|evals|stats|versions, default preview). The shell,
   list, editor and tabs are colocated under ../_components/SkillsListView. */
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { SkillsListView } from "../_components/SkillsListView";

export default function SkillEditorPage() {
  const params = useParams<{ id: string }>();
  return <SkillsListView selectedId={params.id} />;
}
