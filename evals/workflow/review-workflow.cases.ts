import type { WorkflowCase } from "../src/index.js";

/**
 * Systemic ("workflow") tier — asserts the real on-disk harness (CLAUDE.md + skills + subagents,
 * loaded via settingSources:["project"]) behaves as documented. Organized by scenario, not by a
 * single artifact, because these behaviors are cross-cutting.
 *
 * Budget: 6 cases, 10 Claude sessions total, each case capped at 2 runs.
 *   - 2 × trace (1 session each)                            = 2
 *   - 2 × activation pair (positive + near-miss negative)    = 4
 *   - 1 × dispatch pair (positive + near-miss negative)      = 2
 *   - 1 × contrast (treatment + control)                     = 2
 *
 * `trace` folds several assertions into ONE session (cheaper, coarser) and stops early once its
 * evidence is in — so a dispatch-bearing trace never waits out the nested subagent's full run.
 */
export const cases: WorkflowCase[] = [
  // --- trace (1 session): CLAUDE.md "Read When" routing + subagent dispatch, together -----------
  {
    kind: "trace",
    // Endpoint must NOT already exist, or the model reviews the existing code inline instead of
    // planning-then-dispatching. GET /reviews/:id/export is genuinely absent from routes.ts.
    name: "API-route task reads server + repo-intel docs AND pulls the architecture-reviewer",
    prompt:
      "Я планую додати НОВИЙ, ще не реалізований ендпоінт GET /reviews/:id/export (віддає ревʼю як " +
      "markdown), і він буде використовувати repo-intel. Спершу звірся з конвенціями API цього репо " +
      "та з тим, як влаштований repo-intel. Потім ОБОВʼЯЗКОВО запусти сабагента architecture-reviewer, " +
      "щоб він оцінив мій план на відповідність onion-шарам — не рецензуй сам.",
    expectFilesRead: ["server/README.md", "server/src/modules/repo-intel/README.md"],
    expectSubagents: ["architecture-reviewer"],
    maxTurns: 8,
  },

  // --- trace (1 session): CLAUDE.md "Hit unexpected behavior" routing -> INSIGHTS -----------------
  {
    kind: "trace",
    name: "CLAUDE.md routes a lesson-learned lookup to reviewer-core/INSIGHTS.md",
    prompt:
      "У reviewer-core я стикнувся з несподіваною поведінкою — щось працює не так, як я очікував. " +
      "За настановами цього репо, де це вже могло бути задокументовано? Прочитай той файл.",
    expectFilesRead: ["reviewer-core/INSIGHTS.md"],
    maxTurns: 5,
  },

  // --- activation pair (2 sessions): positive + near-miss negative ------------------------------
  {
    kind: "activation",
    name: "engineering-insights activates on a genuine discovery",
    prompt:
      "Щойно з'ясував, чому pgvector-запит повертав нуль рядків — розмірність колонки не збіглася " +
      "після зміни моделі ембедингів. Хочу це зафіксувати, щоб більше не наступати.",
    skill: "engineering-insights",
    shouldActivate: true,
    maxTurns: 4,
  },
  {
    kind: "activation",
    name: "near-miss negative — explaining the same topic must NOT record an insight",
    prompt:
      "Поясни, як у pgvector працюють розмірності колонок і чому невідповідність повертає нуль рядків.",
    skill: "engineering-insights",
    shouldActivate: false,
    maxTurns: 4,
  },

  // --- activation pair (2 sessions): positive + near-miss negative ------------------------------
  {
    kind: "activation",
    name: "onion-architecture activates when placing new server business logic",
    prompt:
      "Додаю новий бізнес use-case у server-модуль reviews: розрахунок ризик-скору для PR. " +
      "У якому шарі (routes/service/repository) має жити ця логіка за конвенціями цього репо?",
    skill: "onion-architecture",
    shouldActivate: true,
    maxTurns: 4,
  },
  {
    kind: "activation",
    name: "near-miss negative — a pure UI copy tweak must NOT trigger onion-architecture",
    prompt: "Зміни текст кнопки 'Створити ревʼю' на 'Запустити ревʼю' в client UI.",
    skill: "onion-architecture",
    shouldActivate: false,
    maxTurns: 4,
  },

  // --- dispatch pair (2 sessions): positive + near-miss negative --------------------------------
  {
    kind: "dispatch",
    name: "architecture-reviewer dispatches for a genuine layering question",
    prompt:
      "Хочу перенести частину логіки формування review payload з reviewer-core у server-модуль, " +
      "щоб server міг кастомізувати вихідний формат. ОБОВʼЯЗКОВО запусти сабагента architecture-reviewer, " +
      "щоб перевірити цей план на порушення onion-шарів — не рецензуй сам.",
    expectSubagent: "architecture-reviewer",
    shouldDispatch: true,
    maxTurns: 8,
  },
  {
    kind: "dispatch",
    name: "near-miss negative — a cosmetic UI fix must NOT dispatch architecture-reviewer",
    prompt: "Виправ одруківку в тексті кнопки 'Створити ревʼю' в client UI.",
    expectSubagent: "architecture-reviewer",
    shouldDispatch: false,
    maxTurns: 6,
  },

  // --- contrast (2 sessions): treatment (real repo) vs control (empty tmpdir) --------------------
  {
    kind: "contrast",
    name: "CLAUDE.md routes an e2e-flow question to e2e/README.md (real repo only)",
    prompt:
      "Хочу додати новий e2e-тест-флоу. За конвенціями цього репо, де описано, як влаштований " +
      "раннер і формат флоу-файлів? Прочитай той файл.",
    expectFileRead: "e2e/README.md",
    maxTurns: 5,
  },
];
