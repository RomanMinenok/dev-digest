import type { WorkflowCase } from "../src/index.js";

/**
 * Systemic ("workflow") tier — asserts the real on-disk harness (CLAUDE.md + skills + subagents,
 * loaded via settingSources:["project"]) behaves as documented. Organized by scenario, not by a
 * single artifact, because these behaviors are cross-cutting.
 *
 * What the harness guarantees these cases (see src/config.ts):
 *   - The repo's HOOKS are muted (DEVDIGEST_EVAL). They used to pre-answer the questions asked
 *     here — the UserPromptSubmit nudge names the INSIGHTS.md files outright, and the Stop hook
 *     orders "invoke engineering-insights" whenever the tree is dirty.
 *   - Bash / WebSearch / WebFetch / MCP are cut off, so the only way to an answer is the harness.
 *
 * Two things every case author must respect:
 *   1. Do NOT name the artifact under test in the prompt ("run the architecture-reviewer subagent")
 *      unless the case is explicitly a capability smoke test. A named artifact turns a routing eval
 *      into an obedience eval: it would keep passing after the artifact's description rotted away.
 *   2. A negative ("must NOT dispatch/activate") is only evidence in a session that ENDED ON ITS
 *      OWN — the runner enforces this. Give negatives a generous turn budget; a truncated run is
 *      scored as a failure, not as restraint.
 *
 * Budget: 10 cases, 11 Claude sessions, each case capped by its own maxTurns.
 *   - 4 × trace (1 session each)                             = 4
 *   - 1 × activation positive + 2 × activation negative      = 3
 *   - 1 × dispatch positive + 1 × dispatch negative          = 2
 *   - 1 × contrast (treatment + control)                     = 2
 *
 * `trace` folds several assertions into ONE session and stops early once its evidence is in — so a
 * dispatch-bearing trace never waits out the nested subagent's full run. A trace with `expectText`
 * is the exception: it must reach the final answer, so it runs to the end.
 */
export const cases: WorkflowCase[] = [
  // --- trace (1 session): dispatch CAPABILITY smoke test ----------------------------------------
  // The ONE case that names the subagent on purpose: it answers "can this model dispatch at all,
  // through this harness" — the question that decides whether every other dispatch case is even
  // interpretable. (evals/README.md records that DeepSeek does the work inline instead.) It rides
  // along on a doc-routing assertion so the session isn't spent on the smoke test alone.
  //
  // The endpoint must NOT already exist, or the model reviews the existing code inline instead of
  // planning-then-dispatching. GET /reviews/:id/export is genuinely absent from routes.ts.
  {
    kind: "trace",
    name: "API-route task reads server + repo-intel docs AND can dispatch the architecture-reviewer",
    prompt:
      "Я планую додати НОВИЙ, ще не реалізований ендпоінт GET /reviews/:id/export (віддає ревʼю як " +
      "markdown), і він буде використовувати repo-intel. Спершу звірся з конвенціями API цього репо " +
      "та з тим, як влаштований repo-intel. Потім ОБОВʼЯЗКОВО запусти сабагента architecture-reviewer, " +
      "щоб він оцінив мій план на відповідність onion-шарам — не рецензуй сам.",
    expectFilesRead: ["server/README.md", "server/src/modules/repo-intel/README.md"],
    expectSubagents: ["architecture-reviewer"],
    // The question is about the server; the client's docs have no business in this trace.
    expectFilesNotRead: ["client/CLAUDE.md", "client/README.md"],
    maxTurns: 8,
  },

  // --- trace (1 session): CLAUDE.md "past bug / lesson" routing, and that the lesson is USED -----
  // reviewer-core/CLAUDE.md:25-27 routes "a past bug / lesson in this package" → INSIGHTS.md. The
  // question is deliberately one whose answer is ONLY in that file (the promptParts / PromptAssembly
  // threading rule), so expectText proves the model read the lesson rather than opened the file and
  // improvised from the source.
  {
    kind: "trace",
    name: "CLAUDE.md routes a reviewer-core lesson lookup to INSIGHTS.md — and the lesson lands",
    prompt:
      "Хочу додати нову секцію в промпт reviewer-core (має зникати, коли поле порожнє). За настановами " +
      "цього репо, де вже задокументовано, як це робиться і на чому тут спотикаються? Знайди, прочитай " +
      "і перекажи кроки.",
    expectFilesRead: ["reviewer-core/INSIGHTS.md"],
    expectText: ["promptParts", "PromptAssembly"],
    // Routing must be package-scoped: the other modules' INSIGHTS.md are the wrong answer.
    expectFilesNotRead: ["server/INSIGHTS.md", "client/INSIGHTS.md", "e2e/INSIGHTS.md"],
    maxTurns: 6,
  },

  // --- trace (1 session): the root map's own content, not just its pointers ---------------------
  // Nothing else grades root CLAUDE.md's "Conventions (non-default)" section, and it states two
  // things a model WILL otherwise get wrong from priors: this is not a pnpm workspace, and
  // cross-package imports resolve to TS source through tsconfig path aliases.
  {
    kind: "trace",
    name: "root CLAUDE.md conventions beat the model's prior (path aliases, not a pnpm workspace)",
    prompt:
      "Як саме client отримує код із reviewer-core у цьому репо? Це pnpm workspace? Відповідай за " +
      "конвенціями саме цього репо.",
    expectText: ["alias", "tsconfig"],
    maxTurns: 3,
  },

  // --- trace (1 session): skill activation + the skill's actual layer mapping in the answer -----
  // Expressed as a trace rather than an `activation` case so it asserts BOTH that onion-architecture
  // engaged AND that its layer mapping reached the answer — activation without effect is not a pass.
  {
    kind: "trace",
    name: "onion-architecture engages for new server business logic and names the right layer",
    prompt:
      "Додаю новий бізнес use-case у server-модуль reviews: розрахунок ризик-скору для PR. " +
      "У якому шарі (routes/service/repository) має жити ця логіка за конвенціями цього репо?",
    expectSkills: ["onion-architecture"],
    expectText: ["service.ts", "repository.ts"],
    maxTurns: 6,
  },

  // --- activation negative: near-miss for onion-architecture ------------------------------------
  {
    kind: "activation",
    name: "near-miss negative — a pure UI copy tweak must NOT trigger onion-architecture",
    prompt: "Зміни текст кнопки 'Створити ревʼю' на 'Запустити ревʼю' в client UI.",
    skill: "onion-architecture",
    shouldActivate: false,
    // Generous on purpose: the session must end by itself for the absence to mean anything.
    maxTurns: 10,
  },

  // --- activation pair: engineering-insights ----------------------------------------------------
  {
    kind: "activation",
    name: "engineering-insights activates on a genuine discovery",
    // Self-contained on purpose: an underspecified prompt makes the model spend its turn asking
    // for the missing numbers (CLAUDE.md tells it to ask before acting), and the case then measures
    // prompt completeness rather than skill activation. Every fact the skill needs is given here.
    prompt:
      "Щойно з'ясував, чому pgvector-запит повертав нуль рядків: ми перейшли з ембедингів " +
      "text-embedding-3-small (1536 вимірів) на bge-base (768), але колонка лишилась vector(1536), " +
      "і пошук мовчки повертав порожньо замість помилки. Полагодив міграцією колонки на vector(768) " +
      "з переіндексацією. Хочу це зафіксувати, щоб більше не наступати.",
    skill: "engineering-insights",
    shouldActivate: true,
    // Write/Edit are blocked, so the skill will try to write INSIGHTS.md and be denied; it needs
    // room to get as far as engaging (which is all this case asserts) without hitting the cap.
    maxTurns: 6,
  },
  {
    kind: "activation",
    name: "near-miss negative — explaining the same topic must NOT record an insight",
    // Previously this passed for the wrong reason: the model answered off WebSearch/MCP and never
    // touched the harness at all. Both are cut off now, so the restraint being measured is real.
    prompt:
      "Поясни, як у pgvector працюють розмірності колонок і чому невідповідність повертає нуль рядків.",
    skill: "engineering-insights",
    shouldActivate: false,
    maxTurns: 10,
  },

  // --- dispatch pair: the REAL routing test (subagent never named) -------------------------------
  // The prompt describes the situation the architecture-reviewer's description claims to own
  // ("delegate here after implementation / when a design's soundness is in question") and says
  // nothing about subagents. If that description rots, this case fails — which is the whole point.
  {
    kind: "dispatch",
    name: "architecture-reviewer dispatches for a genuine layering question (subagent not named)",
    prompt:
      "Я переніс частину логіки формування review payload з reviewer-core у server-модуль, щоб server " +
      "міг кастомізувати вихідний формат. Мене турбує, що це ламає шари. Зроби архітектурне ревʼю цієї " +
      "зміни за правилами цього репо.",
    expectSubagent: "architecture-reviewer",
    shouldDispatch: true,
    maxTurns: 10,
  },
  {
    kind: "dispatch",
    name: "near-miss negative — a cosmetic UI fix must NOT dispatch architecture-reviewer",
    prompt: "Виправ одруківку в тексті кнопки 'Створити ревʼю' в client UI.",
    expectSubagent: "architecture-reviewer",
    shouldDispatch: false,
    maxTurns: 10,
  },

  // --- contrast (2 sessions): treatment (harness loaded) vs control (same repo, no harness) ------
  // Both sides run in the REAL repo with the same tools and turn budget; only CLAUDE.md differs.
  // The claim under test is that the map is a SHORTCUT: with it, e2e/README.md is reached almost
  // immediately (root map → e2e/CLAUDE.md → README); without it, the model has to search the tree
  // first. The control is allowed to find the file — it just must not find it that fast.
  {
    kind: "contrast",
    name: "CLAUDE.md routes an e2e-flow question to e2e/README.md faster than an unmapped repo",
    prompt:
      "Хочу додати новий e2e-тест-флоу. За конвенціями цього репо, де описано, як влаштований " +
      "раннер і формат флоу-файлів? Прочитай той файл.",
    expectFileRead: "e2e/README.md",
    withinToolCalls: 3,
    maxTurns: 6,
  },
];
