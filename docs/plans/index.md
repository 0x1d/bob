# Plans Index

Canonical index for implementation plans.

## Purpose

Plans coordinate execution work and link implementation to specs and decisions.

## Plan Format

Each plan should include:

- **ID** - unique identifier (e.g., `PLAN001`)
- **Title** - concise implementation objective
- **Spec References** - impacted requirements/spec files
- **Status** - `review` | `in progress` | `done`
- **Dependencies** - prerequisites and blockers
- **Success Criteria** - verification conditions
- **Description** - execution details and scope
- **Guidelines** - constraints for execution

## File Naming

Use `PLANXXX.md` with zero-padded numeric IDs.

## Authoring Rules

1. Create a plan before significant implementation changes.
2. Keep one plan focused on one cohesive implementation unit.
3. Number sequentially and update this index in the same change.
4. Link to affected specs using relative links.
5. Include cross-spec dependencies in the description.

## Index

| ID | Title | Link |
|----|-------|------|
| PLAN001 | Review and refine all specs | [PLAN001.md](./PLAN001.md) |
