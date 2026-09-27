Tasawuq — AI Development Guidelines

Project

This is Tasawuq (تسوق), a mobile-first local marketplace application.

Current regional identity:

تسوق | الكرك الشرقي

The product is designed to start in Al-Karak Al-Sharqi and be expandable to other regions later.

The application is currently in the foundation stage. Do not implement future marketplace, ordering, delivery, payment, or financial features unless explicitly requested.

Current Milestone

Focus only on:

1. Project foundation
2. Brand identity
3. Visual design system
4. Splash screen
5. Login UI
6. Sign-up UI
7. Basic navigation between authentication screens

Do not implement yet:

- Products
- Stores marketplace
- Cart
- Orders
- Multi-store orders
- Delivery
- Drivers
- Payments
- Financial ledger
- Merchant subscriptions
- Customer delivery subscriptions
- Promotions
- Reviews
- Notifications
- Search
- AI recommendations
- Supabase business logic

These are future phases.

Technology

- React Native
- Expo SDK 57
- TypeScript
- Expo Router
- Mobile-first architecture

Use the existing Expo project structure.

Routes belong in:

"src/app/"

Reusable UI and application code belong outside the route directory, for example:

- "src/components/"
- "src/hooks/"
- "src/constants/"
- "src/utils/"

Do not put reusable non-route code inside "src/app/".

Expo Documentation Rule

Expo changes between SDK releases.

Never rely on remembered Expo or React Native APIs.

Before writing code that uses an Expo, EAS, or React Native API:

1. Read the installed Expo version from "package.json".
2. Use the matching Expo documentation.
3. For Expo documentation, prefer:
   - "https://docs.expo.dev/versions/v57.0.0/"
   - "https://docs.expo.dev/llms.txt"
4. Follow the relevant documentation links before implementing unfamiliar APIs.

Do not assume that an API from an older Expo SDK is still valid.

Package Management

If the project uses Bun ("bun.lock" exists), use Bun.

Otherwise use npm.

For Expo-compatible packages, always use:

"npx expo install <package>"

Do not use "npm install" to select versions of Expo-compatible packages.

Before adding a dependency:

1. Check whether Expo already provides an official solution.
2. Check the project's available skills/instructions.
3. Confirm that the dependency supports Expo SDK 57.
4. Avoid adding dependencies unless they provide clear value.

Navigation

Use Expo Router for navigation.

Routes live in:

"src/app/"

Use:

- "Link"
- "router"
- "useLocalSearchParams"

from "expo-router".

Do not introduce another navigation library.

Mobile-First Design

Design for phones first.

Priorities:

1. Touch-friendly controls
2. Responsive layouts
3. Safe areas
4. Keyboard handling
5. Different screen sizes
6. Android and iOS compatibility
7. RTL support

Avoid fixed dimensions when responsive sizing is more appropriate.

Do not assume a specific phone resolution.

Arabic and RTL

Tasawuq is an Arabic-first application.

The UI must support Arabic and RTL correctly.

Do not hard-code left/right behavior when logical RTL-aware alternatives are appropriate.

Prefer:

- "start" / "end"
- RTL-compatible layouts
- logical spacing
- platform-safe typography

Arabic text should remain readable and visually balanced.

English support may be added later, so avoid designs that make localization unnecessarily difficult.

Brand Direction

The visual identity should represent the local identity of Al-Karak Al-Sharqi.

The current logo concept combines:

- old fortified walls / historical settlement
- wheat
- shopping basket

The brand should feel:

- local
- trustworthy
- modern
- simple
- recognizable
- suitable for expansion beyond the initial region

Avoid generic delivery-app branding as the primary visual identity.

The application brand is:

تسوق

The regional identity is:

الكرك الشرقي

Do not hard-code the regional name throughout the application where a future region-specific configuration would be more appropriate.

UI Principles

Prefer:

- simple layouts
- clear hierarchy
- large touch targets
- consistent spacing
- reusable components
- accessible contrast
- readable Arabic typography
- subtle animations only where useful

Avoid:

- unnecessary gradients
- excessive animation
- cluttered screens
- deeply nested components
- duplicated styling
- premature design-system complexity

Code Quality

Write small, focused components.

Prefer composition over large monolithic components.

Keep business logic out of presentation components when practical.

Use TypeScript types rather than "any".

Do not suppress TypeScript errors without understanding the cause.

Do not leave debugging code, console spam, or temporary hacks in completed work.

File Changes

Before creating a new file, check whether an existing component or utility can be reused.

Do not create duplicate components with slightly different names.

Keep route files focused on screens and navigation.

Native Projects

If "ios/" and "android/" do not exist, do not create them manually.

Expo Continuous Native Generation is used.

Configure native behavior through:

- "app.json"
- Expo config plugins
- supported Expo configuration

Do not manually edit generated native projects unless explicitly required.

Current Architecture

The project will eventually grow into a marketplace platform containing customers, merchants, stores, products, orders, drivers, delivery, payments, and financial settlement.

However, those systems are not part of the current milestone.

Do not prematurely create:

- database schemas
- API layers
- payment abstractions
- delivery algorithms
- financial ledger code
- merchant management
- driver management

unless the task explicitly requires them.

AI Development Rules

AI-generated code must be treated as proposed code, not automatically trusted code.

For every significant task:

1. Understand the requirement.
2. Inspect the existing project.
3. Check relevant Expo documentation.
4. Make the smallest reasonable change.
5. Run validation.
6. Review the resulting code.

Do not rewrite unrelated files.

Do not introduce architecture that is not required by the current task.

Do not build multiple future features "while you're here".

Validation

Before declaring a task complete, run:

"npx expo lint"

and:

"npx tsc --noEmit"

If either fails, investigate and fix the issue before considering the task complete.

For dependency or configuration problems, use:

"npx expo-doctor"

When appropriate, use:

"npx expo install --fix"

Definition of Done

A task is complete only when:

- The requested behavior is implemented.
- The code follows the project structure.
- Expo SDK 57 compatibility has been considered.
- RTL/mobile behavior has been considered where relevant.
- No unrelated features were added.
- Lint passes.
- TypeScript passes.
- The project remains runnable with Expo.

Important

When requirements are unclear, do not invent large features.

Prefer the smallest implementation that satisfies the explicit requirement and preserves room for future expansion.
