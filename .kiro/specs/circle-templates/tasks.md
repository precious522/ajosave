# Implementation Plan: Circle Templates

## Overview

Add a static template selector above the Create Circle form. The feature is entirely client-side: a new data file defines four templates, a new `TemplateSelector` component renders them, and `CreateCircleForm` is updated to integrate the selector and apply templates via `react-hook-form`'s `reset()`.

## Tasks

- [x] 1. Create static template data file
  - Create `src/data/circleTemplates.ts` with the `CircleTemplate` interface and `CIRCLE_TEMPLATES` array containing the four templates: `family-monthly-ngn`, `friends-weekly-ngn`, `diaspora-monthly-gbp`, `small-group-biweekly-ngn`
  - Type the `values` field against `CreateCircleInput` so TypeScript catches any template values that violate the zod schema constraints at compile time
  - Export both `CircleTemplate` and `CIRCLE_TEMPLATES`
  - _Requirements: 1.1, 1.4, 5.1, 5.3_

  - [ ]* 1.1 Write data integrity tests for `circleTemplates.ts`
    - **Property 1: Template count is within bounds** — assert `CIRCLE_TEMPLATES.length >= 3 && <= 5`
    - **Validates: Requirements 1.1**
    - Assert at least one NGN template, one GBP template, and one monthly template exist
    - Assert every template's `values` satisfies `createCircleSchema` (parse each with the zod schema and expect no errors)
    - _Requirements: 1.1, 1.4, 5.1_

- [x] 2. Build the `TemplateSelector` component
  - [x] 2.1 Create `src/components/circle/TemplateSelector.tsx`
    - Define `TemplateSelectorProps` interface: `templates: CircleTemplate[]`, `activeTemplateId: string | null`, `onSelect: (template: CircleTemplate | null) => void`
    - Render a horizontally scrollable row of template cards plus a "Blank" card at the start
    - Each template card displays: template name, contribution amount, currency, member count, and cycle frequency
    - Set `aria-pressed="true"` on the active card and `aria-pressed="false"` on all others (including blank when a template is active)
    - Clicking a template card calls `onSelect(template)`; clicking the blank card calls `onSelect(null)`
    - _Requirements: 1.2, 1.3, 2.8, 4.1, 5.2_

  - [x] 2.2 Create `src/components/circle/TemplateSelector.module.css`
    - Style the container as a horizontally scrollable row
    - Style individual template cards with padding, border, and border-radius
    - Add a distinct active-card style (e.g. highlighted border) applied when `aria-pressed="true"`
    - _Requirements: 1.2, 2.8_

  - [ ]* 2.3 Write component tests for `TemplateSelector` in `src/components/circle/__tests__/TemplateSelector.test.tsx`
    - **Property 2: Every template card renders all required metadata** — for each template in `CIRCLE_TEMPLATES`, assert name, amount, currency, member count, and frequency are visible in the rendered output
    - **Validates: Requirements 1.3**
    - Assert the "Blank" card is rendered
    - Assert clicking a template card calls `onSelect` with the correct template object
    - Assert clicking the blank card calls `onSelect(null)`
    - **Property 4: Active template is visually indicated** — assert the active card has `aria-pressed="true"` and all other cards have `aria-pressed="false"`
    - **Validates: Requirements 2.8**
    - Assert no network request is made during render (spy on `global.fetch` and assert it was not called)
    - _Requirements: 1.3, 2.8, 4.1, 5.2_

- [x] 3. Integrate `TemplateSelector` into `CreateCircleForm`
  - [x] 3.1 Modify `src/components/circle/CreateCircleForm.tsx`
    - Extract the existing `defaultValues` object into a named `FORM_DEFAULTS` constant (typed as `CreateCircleInput`) so it can be reused in the blank-reset path
    - Add `const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)` to local state
    - Obtain `reset` from `useForm` (add it to the destructured return)
    - Add `handleTemplateSelect(template: CircleTemplate | null)`: if non-null call `reset(template.values)` and `setActiveTemplateId(template.id)`; if null call `reset(FORM_DEFAULTS)` and `setActiveTemplateId(null)`
    - Import `TemplateSelector` and `CIRCLE_TEMPLATES` and render `<TemplateSelector templates={CIRCLE_TEMPLATES} activeTemplateId={activeTemplateId} onSelect={handleTemplateSelect} />` above the form fields, inside the `<form>` element
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.3, 4.2, 4.3_

  - [ ]* 3.2 Extend `src/components/circle/__tests__/CreateCircleForm.test.tsx` with integration tests
    - **Property 3: Selecting a template populates all form fields** — for each template in `CIRCLE_TEMPLATES`, simulate clicking its card and assert every form field reflects the template's values
    - **Validates: Requirements 2.1–2.7**
    - **Property 5: Switching templates overwrites all fields** — select template A then template B; assert all fields equal B's values
    - **Validates: Requirements 3.3**
    - **Property 6: Selecting blank resets to original defaults** — select a template then click blank; assert all fields equal `FORM_DEFAULTS` values
    - **Validates: Requirements 4.3**
    - Assert fields remain editable after template selection (change a field value after selecting a template and assert the new value is present)
    - Assert edited field value is retained (change a field, then assert it still holds the edited value without re-selecting a template)
    - Assert form submits the user's final values after template selection and a field edit
    - _Requirements: 2.1–2.7, 3.1, 3.2, 3.3, 3.4, 4.3_

- [x] 4. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The design has a Correctness Properties section; property tests are included as sub-tasks and annotated with their property numbers
- No backend changes are required — the entire feature is client-side
- `reset()` from react-hook-form is the idiomatic way to apply a template; it atomically replaces all field values and clears validation errors
