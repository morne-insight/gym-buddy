## ADDED Requirements

### Requirement: Audio-reactive Aura on the session screen

The mobile session screen SHALL display a native "Aura" visualizer — a glowing ring rendered
with `@shopify/react-native-skia` — in place of the previous static circle/emoji, and the Aura's
motion and intensity SHALL react to the Buddy's live audio in real time.

#### Scenario: Aura replaces the static circle

- **WHEN** the active workout session screen is shown
- **THEN** the centered element is the Aura visualizer (a Skia-rendered glowing ring)
- **AND** the previous static bordered circle with a swapped emoji is no longer rendered

#### Scenario: Aura reacts to the Buddy speaking

- **WHEN** the agent is producing audio (its audio track has non-zero amplitude)
- **THEN** the Aura visibly intensifies and expands in proportion to the audio level
- **AND** it returns toward its resting size as the audio level falls

#### Scenario: Aura animates without live audio

- **WHEN** there is no audio amplitude on the agent track
- **THEN** the Aura still renders a continuous, gentle ambient animation (it is never a frozen image)

### Requirement: Aura reflects agent state

The Aura SHALL reflect the four agent states — Connecting, Listening, Speaking, and Thinking —
through distinct visual treatment (color and/or motion), so the user can tell the Buddy's state
from the visualizer at a glance.

#### Scenario: Distinct state appearance

- **WHEN** the agent state is one of Connecting, Listening, Speaking, or Thinking
- **THEN** the Aura presents a visual treatment distinct to that state
- **AND** transitions between states are animated rather than abrupt

#### Scenario: Connecting before the agent is ready

- **WHEN** the agent has not yet connected (connecting/initializing)
- **THEN** the Aura shows a calm "connecting" treatment and does not appear failed or frozen

### Requirement: Audio level derivation

The system SHALL derive the Aura's audio reactivity from the agent's audio track using the
native FFT-backed `useMultibandTrackVolume` hook from `@livekit/react-native`, reduced to a
single normalized level, and SHALL NOT depend on the Web Audio API (which is unavailable in
React Native).

#### Scenario: Native audio analysis

- **WHEN** the Aura needs an audio level for an agent audio track
- **THEN** it obtains per-band magnitudes from the native `useMultibandTrackVolume` hook
- **AND** reduces them to a single normalized `0..1` level used to drive the visualizer

#### Scenario: Missing or placeholder audio track

- **WHEN** no audio track is available yet (placeholder)
- **THEN** the audio level resolves to zero and the Aura falls back to its ambient animation without error

### Requirement: Preserve existing session behavior

Introducing the Aura SHALL NOT regress existing session behaviors.

#### Scenario: Status, audio, and overlays unaffected

- **WHEN** the Aura is present on the session screen
- **THEN** the semantic agent status label and dot continue to reflect the agent's state correctly
- **AND** agent audio remains audible (the AudioSession start/stop and connect-timeout behavior is unchanged)
- **AND** the exercise GIF overlay, rest timer, and session FAB continue to function
- **AND** ending the workout disconnects the session cleanly
