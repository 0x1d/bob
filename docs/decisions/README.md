# Decisions

This folder contains documentation for all decisions made during the specification process.

- [decisions.md](./decisions.md) - Decision index

## Decision Format

Each decision is stored in a separate file with the format:

- **ID** - Unique decision identifier (e.g., DEC001)
- **Title** - Brief title of the decision
- **Context** - Why the decision was needed
- **Options Considered** - Alternatives evaluated
- **Decision Made** - Chosen approach
- **Rationale** - Why this option was selected
- **Consequences** - Expected and actual outcomes
- **References** - Related specs and design docs

## File Naming Convention

Decisions are named `DECXXX.md` where XXX is the zero-padded number (e.g., DEC001.md).

## Guidelines

1. Create a new decision file before making a significant architectural change
2. Number decisions sequentially (DEC001, DEC002, etc.)
3. Keep each decision focused on a single topic
4. Update the [decisions.md](./decisions.md) index with the new link
