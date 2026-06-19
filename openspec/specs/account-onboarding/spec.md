# account-onboarding Specification

## Purpose
Defines the first-run flow and profile: capturing name, Buddy, optional goal text, optional goal image (signed-URL upload to Supabase Storage), and training style; creating and later editing the profile.

## Requirements

### Requirement: Onboarding captures the user profile
After authentication, the system SHALL let the user set their profile: `name` (required), Buddy (`persona_id`, required), `goal_description` (optional free text), and `training_style` (required, selected from a fixed list that currently contains a single option). These values SHALL be written to the caller's `users` row via the server.

#### Scenario: Completing the profile step
- **WHEN** an authenticated user submits a name, a selected Buddy, an optional goal description, and a training style
- **THEN** the server SHALL persist those values on the caller's `users` row

#### Scenario: Required fields are enforced
- **WHEN** a profile submission is missing a name, Buddy, or training style
- **THEN** the server SHALL reject the request via contract validation and SHALL NOT write a partial profile

### Requirement: Buddy is chosen from the seeded personas
The system SHALL present the available Buddies from the `personas` table and SHALL store the chosen one as `users.persona_id`. The selection SHALL reference an existing persona.

#### Scenario: Selecting a Buddy
- **WHEN** the user picks a Buddy from the presented list
- **THEN** `users.persona_id` SHALL be set to that persona's id

#### Scenario: Unknown persona is rejected
- **WHEN** a profile submission references a `persona_id` that does not exist
- **THEN** the server SHALL reject the request

### Requirement: Optional goal image is uploaded via a server-minted signed URL
The system SHALL support an optional goal image. The server SHALL issue a short-lived signed upload URL for the `goal-images` Supabase Storage bucket; the client SHALL upload the file directly to Storage using that URL; the client SHALL then send the resulting object path to the server, which SHALL set `users.goal_image_url`. The client SHALL NOT receive Storage credentials.

#### Scenario: Uploading a goal image
- **WHEN** the user chooses an image and the client requests an upload URL
- **THEN** the server SHALL return a short-lived signed upload URL scoped to the `goal-images` bucket
- **AND** after the client uploads and submits the object path, the server SHALL set `users.goal_image_url`

#### Scenario: Goal image is omitted
- **WHEN** the user completes onboarding without choosing an image
- **THEN** `users.goal_image_url` SHALL remain null and onboarding SHALL still complete

### Requirement: Profile is editable after onboarding
The system SHALL allow an authenticated user to view and update their profile fields after onboarding, through the same server-validated operations.

#### Scenario: Updating the profile later
- **WHEN** an authenticated user changes their goal description or Buddy after onboarding
- **THEN** the server SHALL persist the updated values on their `users` row
