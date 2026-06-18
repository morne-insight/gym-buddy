## ADDED Requirements

### Requirement: Web users authenticate through Supabase Auth
The web client SHALL authenticate users via Supabase Auth using email/password or Google OAuth. A successful authentication SHALL yield a Supabase session (access token + refresh token) persisted by the client. Email confirmation and password reset are NOT required for this change (no SMTP provider is configured).

#### Scenario: Sign up with email and password
- **WHEN** a new visitor submits a valid email and password to the sign-up form
- **THEN** Supabase Auth SHALL create an identity and return a session
- **AND** the client SHALL be considered authenticated without an email-confirmation step

#### Scenario: Sign in with Google
- **WHEN** a visitor completes the Google OAuth flow
- **THEN** Supabase Auth SHALL return a session for the corresponding identity

### Requirement: The server verifies the access token on every API request
The server SHALL require a Supabase access token (Bearer) on all authenticated API routes and SHALL verify it against the Supabase JWKS endpoint, validating the signature and the `iss`, `aud`, and `exp` claims. Requests without a valid token SHALL be rejected with HTTP 401 and SHALL NOT touch the database.

#### Scenario: Missing or invalid token is rejected
- **WHEN** a request to an authenticated route arrives with no token, a malformed token, or an expired token
- **THEN** the server SHALL respond 401 Unauthorized
- **AND** SHALL NOT execute any database query

#### Scenario: Valid token is accepted
- **WHEN** a request carries a token whose signature verifies against the JWKS and whose claims are valid
- **THEN** the server SHALL extract the `sub` claim as the caller's identity and proceed

### Requirement: Identity maps to a domain user, provisioned on first authenticated request
The server SHALL map the verified `sub` claim to `users.id` (1:1). On the first authenticated request for a `sub` with no existing `users` row, the server SHALL provision that row idempotently. Provisioning SHALL be performed by the server, not by a database trigger.

#### Scenario: First authenticated request provisions the domain user
- **WHEN** an authenticated request arrives for a `sub` that has no `users` row
- **THEN** the server SHALL create a `users` row with `id` equal to that `sub`
- **AND** subsequent requests for the same `sub` SHALL reuse the existing row without creating a duplicate

### Requirement: Authorization is enforced in server query logic without RLS
The system SHALL NOT rely on Row Level Security. The server SHALL scope every domain read and write to the caller's `users.id`, so a user can only access their own data.

#### Scenario: A user cannot access another user's data
- **WHEN** an authenticated user requests or attempts to modify a resource owned by a different `users.id`
- **THEN** the server SHALL not return or modify that resource (treating it as not found for the caller)
