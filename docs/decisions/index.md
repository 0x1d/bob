# Decision Index

Canonical index for architecture and specification decisions.

## Purpose

Decisions record why a path was chosen, what alternatives were considered, and
what consequences were observed.

## Decision Format

Each decision should include:

- **ID** - unique identifier (e.g., `DEC001`)
- **Title** - concise decision name
- **Context** - why the decision was needed
- **Options Considered** - alternatives evaluated
- **Decision Made** - chosen approach
- **Rationale** - why the approach was chosen
- **Consequences** - expected and actual outcomes
- **References** - linked specs, research, and plans

## File Naming

Use `DECXXX.md` with zero-padded numeric IDs.

## Authoring Rules

1. Create a decision record before significant architectural changes.
2. Keep one decision per document.
3. Number sequentially and update this index in the same change.
4. Link directly to impacted lifecycle docs (`specs`, `plans`, `research`).

## Index

| ID | Title | Link |
|----|-------|------|
| DEC001 | Specification Organization Approach | [DEC001.md](./DEC001.md) |
