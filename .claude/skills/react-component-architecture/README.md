# react-component-architecture

Skill version: **1.0.0**

Structural and organizational decisions for React components in this project (Next.js 15 + Mantine + TypeScript). Covers component decomposition, where constants/utils/hooks/styles live, business logic separation, and TypeScript prop patterns.

## Files

| File | Purpose |
|------|---------|
| [SKILL.md](SKILL.md) | Rules and decision matrices (load this into context) |
| [examples.md](examples.md) | BAD/GOOD code examples from `client/src/` |
| [references.md](references.md) | Full annotated source list |

## Related Skills

| Skill | Covers |
|-------|--------|
| `react-best-practices` | React API misuse: hooks rules, state anti-patterns, render bugs |
| `next-best-practices` | App Router, RSC boundaries, layouts, data fetching |
| `typescript-expert` | Advanced TypeScript: generics, conditional types, tooling |

## Sources

Research base used to define the rules in this skill. Full annotated list: [references.md](references.md).

| Topic | Key sources |
|-------|-------------|
| Component decomposition | [Container/Presentational Pattern — Patterns.dev](https://www.patterns.dev/react/presentational-container-pattern/) · [Rules of React — react.dev](https://react.dev/reference/rules) · [Josh W. Comeau — Common Mistakes](https://www.joshwcomeau.com/react/common-beginner-mistakes/) |
| Constants extraction | [React Folder Structure 2026 — Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/) · [Bulletproof React — Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) |
| Custom hooks / business logic | [Reusing Logic with Custom Hooks — react.dev](https://react.dev/learn/reusing-logic-with-custom-hooks) · [Hooks Pattern — Patterns.dev](https://www.patterns.dev/react/hooks-pattern/) · [Kent C. Dodds — Hooks Pitfalls](https://kentcdodds.com/blog/react-hooks-pitfalls) · [Separation of Concerns — Felix Gerschau](https://felixgerschau.com/react-hooks-separation-of-concerns/) |
| File / folder structure | [Bulletproof React (28k⭐)](https://github.com/alan2207/bulletproof-react) · [Feature Architecture — Robin Wieruch](https://www.robinwieruch.de/react-feature-architecture/) · [Bulletproof React — project-structure.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) |
| Business logic separation | [Clean React Architecture Pt.6 — Profy.dev](https://profy.dev/article/react-architecture-business-logic-and-dependency-injection) · [Pt.7 — Domain Logic](https://profy.dev/article/react-architecture-domain-logic) · [Pt.8 — React Query](https://profy.dev/article/react-architecture-tanstack-query) · [Business vs App Logic — Medium](https://antonyleme.medium.com/business-vs-application-logic-how-to-separate-and-test-your-reactjs-code-4291d0c983b1) |
| State management | [Application State Management — Kent C. Dodds](https://kentcdodds.com/blog/application-state-management-with-react) · [State Colocation — Kent C. Dodds](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster) · [Context Effectively — Kent C. Dodds](https://kentcdodds.com/blog/how-to-use-react-context-effectively) · [Prop Drilling — Kent C. Dodds](https://kentcdodds.com/blog/prop-drilling) |
| TypeScript props | [Discriminated Unions for React — Developer Way](https://www.developerway.com/posts/advanced-typescript-for-react-developers-discriminated-unions) · [TS for React: 12 Mistakes — GreatFrontend](https://www.greatfrontend.com/blog/typescript-for-react-developers) · [Best Practices TS+React — Naukri Engineering](https://medium.com/naukri-engineering/best-practices-for-typescript-in-react-7a4f642dc54c) |
| Architecture overviews | [Patterns.dev — React Overview](https://www.patterns.dev/react/) · [Josh W. Comeau — RSC](https://www.joshwcomeau.com/react/server-components/) · [Bulletproof React — All Docs](https://github.com/alan2207/bulletproof-react/tree/master/docs) |
