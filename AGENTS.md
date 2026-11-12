# Tasawuq — current project instructions

Read [PROJECT_RULES.md](PROJECT_RULES.md) before every task and continue from [WORK_PROGRESS.md](WORK_PROGRESS.md). These files apply to the entire project and replace the earlier foundation-only guidance, preserved under `archive/legacy-reference/`.

Read [STORE_POLICIES.md](STORE_POLICIES.md) for signup, subscriptions, privacy, user content and store submission changes. Use the shared branded dialogs instead of native alerts and the shared keyboard-aware form container for onboarding inputs.

## Current authorized scope

Treat Tasawuq (تسوق | الكرك الشرقي) as a clean rebuild using useful existing assets and components. Preserve the product's accounts, roles, marketplace catalog, stores, orders and delivery. Replace all previous financial systems with the simplified invoice/account/settlement model in `docs/implementation-master-plan.ar.md` and `docs/simple-finance-spec.ar.md`; the master plan takes precedence when they differ.

The simplified finance flow has passed owner-reported Android tests 1–5. Current work follows `docs/ui-ux-implementation-plan.ar.md`: session-safe live refresh, shared design components, role-specific financial views/forms, notifications, then the remaining screens. Preserve the accepted financial behavior. Per-task wages are the launch scope; salary remains implemented but deferred and not phone-validated. iPhone, remote push and unreported failure/concurrency scenarios remain open. Role-first signup requires birth date for everyone and a merchant-selected subscription plan. Do not rerun the cutover or rewrite tested migrations.

## Execution

- Deliver focused working increments. Do not repeatedly re-audit or rewrite plans instead of doing the authorized work.
- Reuse or improve existing components. Refactor structure/design where it materially helps the current feature; avoid broad cosmetic rewrites and premature abstractions.
- Write every owner-database change as a reviewed migration in `supabase/migrations/`. The owner applies it. Never run SQL, push, reset, change configuration, or modify data on the owner's remote/local databases yourself.
- Isolated disposable synthetic local databases may be used for tests. State what they do and do not prove.
- Archive obsolete unused references under `archive/legacy-reference/`. It is not an active specification or code dependency. Check imports, scripts and runtime links before removing a file.
- Update `WORK_PROGRESS.md` after each increment, closing only work supported by actual evidence. Separate code completion, owner migration application, and phone QA.
- The owner tests on phones. Supply early usable increments and a short concrete phone checklist. Do not wait for theoretical perfection.

## Technology and layout

- React Native, installed Expo SDK 57, TypeScript, Expo Router. Check `package.json` and matching official Expo/React Native documentation before using APIs.
- Routes belong in `src/app/`; reusable code belongs outside it, e.g. `src/components`, `src/hooks`, `src/lib`, `src/constants`.
- Use existing package manager (currently npm). Install Expo-compatible packages with `npx expo install`; justify additional dependencies.
- Configure native behavior through Expo config/plugins. Do not manually create or edit generated `ios/` or `android/` projects without a specific need.
- Arabic-first mobile UI: correct RTL, logical spacing, safe areas, keyboard handling, accessible contrast, readable typography, large touch targets and responsive sizes.
- Preserve the local Tasawuq identity. Keep region settings centralized where practical. No unnecessary gradients, animations or duplicated UI.

## Correctness and financial boundaries

- Use focused typed components/services, no `any`, unexplained error suppression, debug residue or fake success.
- Every trackable record has a stable server-issued readable reference. Different records (order, task, invoice) have distinct references; references never grant access by themselves.
- Money must remain exact; writes are atomic and retry-safe. Preserve ownership checks, result recovery and auditability without reintroducing the previous financial architecture.
- Drivers hand over the full collected cash; wages are paid separately. Cash in the platform treasury is different from receivables and payables.

## Verification

Run `npx expo lint`, `npx tsc --noEmit`, and tests appropriate to the changed behavior. Use `npx expo-doctor` for dependency/configuration issues and the appropriate build when relevant. Fix introduced failures; report existing limitations accurately. Do not repeat successful checks without a new change or unresolved concern.

Never mark a migration as applied, an endpoint as live-verified, or a feature as phone-tested unless that actually happened or the owner explicitly reported it. Keep completion reports concise and actionable.

## Mandatory mobile UI skill and page-by-page review

For every UI/UX, theme, layout, form, navigation, loading, notification presentation or financial presentation task, read and apply [react-native-ui](.agents/skills/react-native-ui/SKILL.md), as well as PROJECT_RULES.md and WORK_PROGRESS.md. Identify the current approved RUI page before editing. Use [the design reference](docs/design-system.ar.md), [actual page inventory](docs/screen-inventory.ar.md), [component inventory](docs/component-inventory.ar.md), [page roadmap](docs/role-page-roadmap.ar.md) and existing TXT glossary. Inspect source consumers; static inventory reachability is not runtime or permission verification.

Work on **one physical main page or one subpage per request**, then stop for the owner's phone test and acceptance before starting another. Reuse, assess, then improve existing components before creating alternatives. A shared-component repair necessary for the current page may affect other consumers: document and test that impact without expanding into their redesign. Record a newly needed subpage separately before implementation.

The owner-requested RUI delivery order is merchant, driver, administration, customer, then shared/auth/legal pages as detailed in the roadmap. This narrows the delivery unit of the earlier UI plan; it does not erase accepted UI-01/TXT-02/FIX-DRV-01, close pending UX-03/04/05/UI-02/UX-FOUNDATION-01, or bypass UI-03's phone-acceptance prerequisite. Preserve the accepted finance core. No application UI/theme changes are authorized by the RUI foundation documentation task itself.
