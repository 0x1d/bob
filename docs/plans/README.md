# Plans

This folder contains implementation plans for the Bob system.

- [index.md](./index.md) - Plan index

## Plan Format

Each plan is stored in a separate file with the format:

- **ID** - Unique plan identifier (e.g., PLAN001)
- **Title** - Brief plan title
- **Spec References** - Which specs this plan addresses
- **Status** - review | in progress | done
- **Dependencies** - Prerequisites
- **Success Criteria** - How to verify completion
- **Description** - Detailed description of the plan
- **Guidelines** - How to execute the plan

## File Naming Convention

Plans are named `PLANXXX.md` where XXX is the zero-padded number (e.g., PLAN001.md).

## Guidelines

1. Create a new plan file before making significant implementation changes
2. Number plans sequentially (PLAN001, PLAN002, etc.)
3. Keep each plan focused on a single implementation task
4. Update the [index.md](./index.md) with the new link
5. Link to affected specs using `[./specs/...](../specs/...)` syntax
6. Include cross-spec dependencies in the plan description
