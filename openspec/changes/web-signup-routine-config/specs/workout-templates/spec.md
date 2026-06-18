## ADDED Requirements

### Requirement: Team-curated Template catalog
The system SHALL store Workout Templates in a team-owned catalog separate from any user's data: `program_templates` (with a `type` of `static` or `rotation`), `template_workouts` (belonging to a program template), `template_exercises` (belonging to a template workout), and default schedule entries. Catalog tables SHALL NOT have a `user_id` column.

#### Scenario: Catalog is team-owned, not user-scoped
- **WHEN** the Template catalog is seeded
- **THEN** each catalog row SHALL exist independently of any user
- **AND** no catalog table SHALL reference a `users` row

### Requirement: Available Templates can be listed
The system SHALL let an authenticated user retrieve the list of available Workout Templates with enough detail to choose one (at least name, type, and the constituent Workouts).

#### Scenario: Listing templates during onboarding
- **WHEN** an authenticated user requests the Template list
- **THEN** the server SHALL return the catalog's Templates with their names, types, and Workouts

### Requirement: Adopting a Template clones it into a new user-owned Program
Adoption SHALL, in a single transaction, clone the chosen Template into new user-owned rows — a `programs` row, its `workouts`, their `workout_exercises`, and `schedule` entries — owned by the caller. The new Program SHALL become the user's single active Program. If a partial failure occurs, the transaction SHALL roll back so no incomplete Program exists.

#### Scenario: Adoption creates an independent Program
- **WHEN** an authenticated user adopts a Template
- **THEN** the server SHALL create a user-owned `programs` row plus cloned `workouts`, `workout_exercises`, and `schedule` rows matching the Template
- **AND** the new Program SHALL be marked active for that user

#### Scenario: Adoption is atomic
- **WHEN** an error occurs partway through cloning a Template
- **THEN** the transaction SHALL roll back, leaving the user with no partial Program

### Requirement: Adopting a rotation Template initializes rotation state
When the adopted Template's `type` is `rotation`, the cloned schedule entries SHALL have `day_of_week` NULL and contiguous `sort_order`, and the server SHALL create a `rotation_state` row for the new Program with `current_index = 0` and `last_completed_at` NULL. When the type is `static`, cloned schedule entries SHALL retain their `day_of_week` values and no `rotation_state` row SHALL be created.

#### Scenario: Rotation adoption seeds rotation_state
- **WHEN** a user adopts a rotation Template with three Workouts
- **THEN** the cloned schedule entries SHALL have `day_of_week` NULL and `sort_order` 0, 1, 2
- **AND** a `rotation_state` row SHALL exist for the new Program with `current_index = 0`

#### Scenario: Static adoption retains days
- **WHEN** a user adopts a static Template
- **THEN** the cloned schedule entries SHALL retain non-null `day_of_week` values
- **AND** no `rotation_state` row SHALL be created

### Requirement: Adoption is a one-time clone with no propagation
After adoption, the user's Program SHALL be fully independent of the catalog Template. Subsequent edits to the user's Program SHALL NOT change the Template, and subsequent edits to the catalog Template SHALL NOT change Programs already adopted from it.

#### Scenario: Template edits do not reach adopted Programs
- **WHEN** the team edits a catalog Template after a user has adopted it
- **THEN** that user's already-adopted Program SHALL remain unchanged
