# References & Research Sources

Sources used to define the rules in this skill. Keep these links — they are the evidence base for each decision.

---

## Component Decomposition

- [Container/Presentational Pattern — Patterns.dev](https://www.patterns.dev/react/presentational-container-pattern/)
  Canonical reference on splitting UI vs logic; covers modern hook-based alternative to the class-era container pattern.

- [Rules of React — react.dev](https://react.dev/reference/rules)
  Official documentation on how React expects components to behave (purity, side-effect rules).

- [Sharing State Between Components — react.dev](https://react.dev/learn/sharing-state-between-components)
  When to split vs co-locate; lifting state explained by the React team.

- [Common Beginner Mistakes — Josh W. Comeau](https://www.joshwcomeau.com/react/common-beginner-mistakes/)
  Practical component structure pitfalls and decomposition anti-patterns.

- [Spectrum of Components — Joy of React (Josh W. Comeau)](https://courses.joshwcomeau.com/joy-of-react/open-house/03-spectrum-of-components)
  Philosophy of component decomposition — when splitting adds value vs adds indirection.

---

## Constants in Separate Files

- [React Folder Structure Best Practices 2026 — Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/)
  Covers `constants.ts` per component folder, extracting magic values; updated annually.

- [Bulletproof React — Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
  Where constants live in a feature-based project (28k⭐ reference repo).

---

## Custom Hooks — Business Logic Extraction

- [Reusing Logic with Custom Hooks — react.dev](https://react.dev/learn/reusing-logic-with-custom-hooks)
  Official docs: how/when to create hooks, naming rules, isolation of state.

- [Hooks Pattern — Patterns.dev](https://www.patterns.dev/react/hooks-pattern/)
  Hooks replacing HOC/render-props for stateful logic extraction.

- [How to Test Custom React Hooks — Kent C. Dodds](https://kentcdodds.com/blog/how-to-test-custom-react-hooks)
  Custom hook structure, what makes a hook testable.

- [5 Tips to Help You Avoid React Hooks Pitfalls — Kent C. Dodds](https://kentcdodds.com/blog/react-hooks-pitfalls)
  What goes wrong when hooks aren't designed with separation in mind.

- [Separation of Concerns with React Hooks — Felix Gerschau](https://felixgerschau.com/react-hooks-separation-of-concerns/)
  How hooks replace the container pattern for separation of concerns.

- [Decouple Your Logic from UI by Creating Custom Hooks — Medium/SWLH](https://medium.com/swlh/decouple-your-logic-from-ui-by-creating-your-own-react-hooks-d291fd2d60dc)
  Practical hook extraction patterns with before/after examples.

---

## Utility Functions

- [Robin Wieruch — Folder Structure](https://www.robinwieruch.de/react-folder-structure/)
  `helpers.ts` per component folder; what belongs there vs in hooks.

- [Bulletproof React — Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
  `utils/` = general-purpose pure JS functions only — NOT business logic.

- [How to Build a Professional React Project Structure — Netguru](https://www.netguru.com/blog/react-project-structure)
  Separation between utils (pure functions) and hooks (stateful logic).

---

## File / Folder Structure

- [Bulletproof React — Full Repo](https://github.com/alan2207/bulletproof-react)
  28k⭐ gold standard for scalable React architecture; feature-based, no cross-feature imports.

- [Bulletproof React — project-structure.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
  Exact folder layout with rationale for each level.

- [React Folder Structure Best Practices 2026 — Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/)
  Scaling from flat → feature-based; co-location of constants/hooks/utils per feature.

- [Feature-based React Architecture — Robin Wieruch](https://www.robinwieruch.de/react-feature-architecture/)
  Feature modules with one-way code flow: shared → features → pages.

- [Recommended Folder Structure for React 2025 — DEV Community](https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc)
  Practical opinionated breakdown with concrete file examples.

---

## Business Logic Separation

- [Path To A Clean React Architecture Pt.6 — Business Logic — Profy.dev](https://profy.dev/article/react-architecture-business-logic-and-dependency-injection)
  Most thorough treatment of business vs application logic distinction; moving logic out of components.

- [Path To A Clean React Architecture Pt.7 — Domain Logic — Profy.dev](https://profy.dev/article/react-architecture-domain-logic)
  Domain logic layer separate from React; dependency injection patterns.

- [Path To A Clean React Architecture Pt.8 — React Query — Profy.dev](https://profy.dev/article/react-architecture-tanstack-query)
  Query layer as the data/business boundary; how TanStack Query shapes architecture.

- [Business vs Application Logic — Antony Leme / Medium](https://antonyleme.medium.com/business-vs-application-logic-how-to-separate-and-test-your-reactjs-code-4291d0c983b1)
  Defining what IS and IS NOT business logic in React; testability criterion.

- [Bulletproof React — State Management Docs](https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md)
  Where application state lives vs business logic vs UI state.

---

## State Management Patterns

- [Application State Management with React — Kent C. Dodds](https://kentcdodds.com/blog/application-state-management-with-react)
  Landmark article: why you probably don't need Redux; React-first state patterns.

- [How to Use React Context Effectively — Kent C. Dodds](https://kentcdodds.com/blog/how-to-use-react-context-effectively)
  Context API patterns, multiple contexts, custom provider hooks.

- [State Colocation Will Make Your React App Faster — Kent C. Dodds](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster)
  Keep state as local as possible; when/why to lift.

- [Prop Drilling — Kent C. Dodds](https://kentcdodds.com/blog/prop-drilling)
  When prop drilling is acceptable vs when to reach for Context.

---

## TypeScript in React

- [Advanced TypeScript for React — Discriminated Unions — Developer Way](https://www.developerway.com/posts/advanced-typescript-for-react-developers-discriminated-unions)
  Discriminated unions for mutually exclusive props; Nadia Makarevich (top React+TS authority).

- [TypeScript for React Developers: 12 Mistakes — GreatFrontend](https://www.greatfrontend.com/blog/typescript-for-react-developers)
  Prop typing, avoiding `any`, union types, interfaces vs types.

- [TypeScript Discriminated Unions for Robust React Components — Medium](https://medium.com/@uramanovich/typescript-discriminated-unions-for-robust-react-components-58bc06f37299)
  Practical discriminated union patterns in component props.

- [Best Practices for TypeScript in React — Naukri Engineering](https://medium.com/naukri-engineering/best-practices-for-typescript-in-react-7a4f642dc54c)
  Comprehensive TS+React patterns from a production engineering team.

---

## Multi-Topic / Architecture Overviews

- [React Overview — Patterns.dev](https://www.patterns.dev/react/)
  All major React patterns in one place; industry reference.

- [Making Sense of React Server Components — Josh W. Comeau](https://www.joshwcomeau.com/react/server-components/)
  Modern React architecture: RSC vs client components, where logic lives in Next.js 15.

- [Bulletproof React — Full Docs Directory](https://github.com/alan2207/bulletproof-react/tree/master/docs)
  All topics: components, state, API layer, testing, security, performance.

- [Project Standards — Bulletproof React](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md)
  Linting, TypeScript strictness, code standards as architecture enforcement.
