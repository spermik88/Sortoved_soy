# Figma Handoff

## Current Stack

- Expo 54
- React Native 0.81
- React Navigation native stack
- Shared UI primitives in `src/components/Ui.tsx`

## What Can Be Ported Reliably

- Layout structure
- Typography hierarchy
- Color tokens
- Spacing, card styles, button styles, fields, pills, step indicators
- New static screens and revised existing screens

## What Is Dynamic And Must Stay Code-Driven

- Camera preview and QR scanning
- Photo capture flows
- Trait and measurement forms with variable-length cards
- Navigation branching by role and app state
- Sync-state and validation logic

## Design Tokens

- Background: `#F4ECDC`
- Surface: `#FFF9EF`
- Muted surface: `#EFE2C7`
- Accent: `#586F2C`
- Accent strong: `#314F22`
- Text: `#2E2417`
- Muted text: `#6E624D`
- Danger: `#A1452D`
- Border: `#D6C7A7`

## Shared UI Primitives

- `Screen`: safe-area page container with optional scroll
- `Title`: centered title and subtitle
- `Card`: rounded content panel
- `Button`: primary, secondary, ghost, danger
- `Field`: labeled text input
- `StatPill`: neutral, success, warning
- `PhotoFrame`: image or placeholder block
- `StepIndicator`: multi-step progress bar

## Screen Inventory

### Core screens

1. `RoleSelection`
2. `PlaceholderRole`
3. `QrScanner`
4. `QrValidation`
5. `TestModeWarning`
6. `MainMenu`
7. `Settings`
8. `Varieties`
9. `VarietyDetail`

### Legacy trait flow

10. `TraitOverview`
11. `TraitInfections`
12. `TraitReview`
13. `TraitCompletion`

### Measurement trait flow

14. `MeasurementTraitFlow` step 1
15. `MeasurementTraitFlow` step 2
16. `MeasurementTraitFlow` step 3
17. `MeasurementTraitFlow` step 4
18. `MeasurementTraitCompletion`

### Auxiliary state

19. loading state via `LoadingBlock`

## Recommended Figma Pages

- `00 Foundations`
- `01 Components`
- `02 Core Flow`
- `03 Trait Flow`
- `04 Measurement Flow`
- `05 Experiments`

## Recommended Figma Components

- Page shell
- Title block
- Card
- Button / 4 variants
- Input field
- Pill / 3 variants
- Photo placeholder
- Progress indicator / 3-step and 4-step
- Trait row
- Infection card
- Measurement card

## Priority Order For Reconstruction

1. Foundations and shared components
2. `RoleSelection`, `MainMenu`, `Varieties`, `VarietyDetail`
3. `QrScanner`, `QrValidation`, `Settings`
4. One full legacy trait flow
5. One full measurement trait flow
6. Remaining variations

## Reverse Sync Strategy

When the Figma file is ready, map edited frames back into these code areas:

- shell and shared atoms: `src/components/Ui.tsx`
- colors: `src/constants/theme.ts`
- onboarding and menu screens: `src/screens/OnboardingScreens.tsx`
- role screens: `src/screens/RoleSelectionScreen.tsx`, `src/screens/PlaceholderRoleScreen.tsx`
- scanner screen: `src/screens/QrScannerScreen.tsx`
- variety screens: `src/screens/VarietyScreens.tsx`
- legacy trait flow: `src/screens/TraitScreens.tsx`
- measurement flow: `src/screens/MeasurementTraitScreens.tsx`

## Important Constraint

This environment can read Figma context and use existing Figma files, but it does not expose a direct general-purpose "create full app screens in Figma" writer API. The reliable workflow is:

1. prepare screen inventory and component map from code
2. create or provide a Figma file
3. rebuild or refine the screens there
4. send the edited Figma file or node links back
5. implement those changes in code
