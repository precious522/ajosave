# Requirements Document

## Introduction

New users of Ajosave struggle to configure savings circles from scratch. This feature introduces pre-built circle templates on the create circle page. A template is a named preset that pre-fills all circle creation form fields with sensible defaults, while still allowing the user to customise any field before submitting. The goal is to reduce friction for first-time circle creators and surface common configurations (e.g. a family monthly savings group in NGN) without removing flexibility.

## Glossary

- **Circle**: A rotating savings group (Ajo/Esusu) managed on the Ajosave platform.
- **Template**: A named, pre-defined set of circle configuration values (name suggestion, contribution amount, currency, member count, cycle frequency, circle type) that can be applied to the create circle form.
- **Template_Selector**: The UI component displayed above the create circle form that lists available templates and allows the user to select one.
- **Create_Circle_Form**: The existing form at `/circles/create` that collects circle configuration and submits it to `POST /api/circles`.
- **User**: An authenticated Ajosave user who is creating a circle.

---

## Requirements

### Requirement 1: Display Templates on the Create Circle Page

**User Story:** As a new user, I want to see pre-built circle templates on the create circle page, so that I can quickly start with a sensible configuration without having to know the right values.

#### Acceptance Criteria

1. THE Template_Selector SHALL display between 3 and 5 templates on the create circle page.
2. WHEN the create circle page loads, THE Template_Selector SHALL be visible above the Create_Circle_Form.
3. THE Template_Selector SHALL display each template's name and a brief description of its configuration (contribution amount, currency, member count, and cycle frequency).
4. THE Template_Selector SHALL include at least one NGN-denominated template, at least one GBP-denominated template, and at least one template with a monthly cycle frequency.

---

### Requirement 2: Apply a Template to the Form

**User Story:** As a user, I want to select a template and have it pre-fill the form fields, so that I can start from a useful default instead of a blank form.

#### Acceptance Criteria

1. WHEN a User selects a template, THE Create_Circle_Form SHALL populate all form fields with the template's values.
2. WHEN a User selects a template, THE Create_Circle_Form SHALL populate the name field with the template's suggested circle name.
3. WHEN a User selects a template, THE Create_Circle_Form SHALL populate the contribution amount field with the template's contribution amount.
4. WHEN a User selects a template, THE Create_Circle_Form SHALL populate the currency selector with the template's currency.
5. WHEN a User selects a template, THE Create_Circle_Form SHALL populate the number of members field with the template's member count.
6. WHEN a User selects a template, THE Create_Circle_Form SHALL populate the cycle frequency selector with the template's cycle frequency.
7. WHEN a User selects a template, THE Create_Circle_Form SHALL populate the circle type selector with the template's circle type.
8. WHEN a User selects a template, THE Template_Selector SHALL visually indicate which template is currently selected.

---

### Requirement 3: Allow Customisation After Template Selection

**User Story:** As a user, I want to edit any field after selecting a template, so that I can adjust the defaults to match my specific group's needs.

#### Acceptance Criteria

1. AFTER a User selects a template, THE Create_Circle_Form SHALL allow the User to edit any pre-filled field.
2. WHEN a User modifies a field after selecting a template, THE Create_Circle_Form SHALL retain the User's edited value and not revert it.
3. WHEN a User selects a different template after already selecting one, THE Create_Circle_Form SHALL overwrite all form fields with the new template's values.
4. THE Create_Circle_Form SHALL submit the User's final field values (whether modified or not) when the User submits the form.

---

### Requirement 4: Skip Template Selection

**User Story:** As a returning user, I want to ignore the templates and fill in the form manually, so that I am not forced to start from a preset.

#### Acceptance Criteria

1. THE Template_Selector SHALL include a clearly labelled option to start with a blank form (no template selected).
2. WHEN no template is selected, THE Create_Circle_Form SHALL display its existing default values.
3. WHEN a User selects a template and then selects the blank option, THE Create_Circle_Form SHALL reset all fields to their original default values.

---

### Requirement 5: Template Data is Defined in the Frontend

**User Story:** As a developer, I want templates to be defined as static frontend data, so that no backend changes are required and the feature can be shipped quickly.

#### Acceptance Criteria

1. THE Template_Selector SHALL source all template data from a static, frontend-only data structure (no API call required to load templates).
2. THE Template_Selector SHALL render all templates without making a network request.
3. WHEN a new template needs to be added or modified, THE system SHALL require only a change to the static template data file, with no database migration or API change.
