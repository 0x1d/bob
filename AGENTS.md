# AGENTS.md

## Core Principles

- **Naintain a mental model:** any system can be expressed as a graph that depics how and why parts of the system relate to each other. The graph representation helps to understand and traverse complex systems efficiently.
- **Maintain consistency:** keep documentation and implementation consistent. Always update documentation before implementation. Review all affected artifacts again after implementation and align them.
- **Mermaid diagrams**: all diagrams in markdopwn files must be Mermaid.

## Work Principles

### Research

- **Build context first:** Before starting any work, gather and understand the required concepts, surrounding codebase, project conventions, and related tasks. Always cite sources.
- **Verify before assuming:** Always confirm facts through inspection; do not make assumptions.
- **Preserve context:** When building up context from research and inspection, store facts, concepts and how things fit together as markdown files below `docs/research` folder. Research documentation must be comprehensible And consice, so that future sessions can continue working without knowledge gap. Do not write verbose docs. Use Mermaid diagrams to convey complex systems and processes.

### Plan

- **Plan before acting:** Always identify next steps and their prerequisites before making any changes.
- **Decompose complex plans:** Complex tasks need to be broken down into small verifiable steps, so that issues surface early.
- **Compose dependency graph:** Complex decomposed tasks need to be brought into a logical order for implementation. Design a direct acyclic dependency graph as a Mermaid diagram in the plan file.
- **No arbitrary estimates:** Do not include speculative or unverified estimates in documentation.
- **Plan with existing behavior in mind:** When planning changes, consider how they will affect existing functionality and ensure your plans preserve current behavior unless updates are explicitly required.
- **Consider verification:** When planning work, always consider the success criteria and how the work will be vesrified.

### Implement

- **Human approval for destructive and complex actions:** Never make changes that could remove, alter, or significantly affect existing content, behavior, or architecture without explicit approval. This includes deletions, modifications, refactors, structural changes, and any action with broad or uncertain impact.
- **Precision over verbosity:** Use targeted edits (grep + edit) rather than rewrites; keep edits minimal and unique.
- **Document decisions:** When making a change, explain the reasoning briefly (e.g., comment or docstring). This helps future maintainers understand intent without guessing. When unsure, ask the human for advice.
- **Incremental changes:** Favor small, isolated modifications over large refactorings; commit after each logical step.
- **Respect existing conventions:** Do not refactor unrelated parts of a file or project; honor style, naming, and structure already in place.
- **Small scope, large impact:** Focus changes narrowly but thoughtfully.
- **Transparency in trade-offs:** Be explicit about why one choice over another was made.
- **Reversibility:** Ensure any change can be undone safely (e.g., add a revert marker or keep the original nearby) before proceeding.
- **Preserve existing behavior:** When modifying code, ensure no unintended side effects on other parts.
- **Script complex changes:** For operations that require multiple sequential steps or involve reading/writing multiple files, prefer writing a NodeJS script to perform the task rather than chaining individual tool calls. This makes the workflow more robust, easier to understand, and simpler to debug.

### Verify

- **Verifiability:** Each change should include reproducible automated verification steps (e.g., tests, CI checks) and measurable success criteria (e.g., performance thresholds, behavior checks).
- **Verification as completion:** A task is only considered done when it has been verified and implementation scope compared to linked documents to check for implementation gaps. Gaps must be flagged, documented and surfaced to the human operator.
- **Traceability:** Every change should be linked to its purpose (e.g., issue, PR, or ticket) so it can be traced back to context and rationale.
- **Git as history:** Use Git commits as your work log; read them in order to understand past decisions and changes when needed.

### Retrospect

- **Retrospect on conclusion:** When concluding work, do a retrospection, summarize the Achievements, list Impediments and Pitfalls, document learnings And ways to improve. link corresponding plan. Store your retrospection as markdown in `docs/retro/` as a separate file. File format: ID, Title, Spec References, Achievements, Impediments, Learnings, Date, Guidelines. File naming convention: `RETROXXX.md`.

### Decisions

- **Document architectural decisions:** Store design decisions in `docs/decisions/` as separate files. Each decision must be a separate file with format: ID, Title, Context, Options Considered, Decision Made, Rationale, Consequences, References. File naming convention: `DECXXX.md`.

### Self-Improve

- **Consolidate learnings:** review past retrospectives, identify reoccuring patterns and issues. distill knowledge, solutions, workflows and automations, in order to handle known situations faster with increased determinism.

### Project Management

The Bob system documentation is organized into distinct areas, each with a specific purpose. These areas work together to ensure systematic, traceable, and high-quality development:

**Specs (docs/specs/)**
- **Purpose:** Define *what* needs to be built by specifying requirements, interfaces, and success criteria for each component of the Bob system
- **How it fits together:** Specs provide the target specification for implementation, serving as the contract between design and code

**Design (docs/design/)**
- **Purpose:** Determine *how* to build something by locking in architecture and tech stack decisions
- **How it fits together:** Designs are created based on specs and become the blueprint for implementation

**Decisions (docs/decisions/)**
- **Purpose:** Record architectural decisions made during development, capturing the context, trade-offs, and rationale behind them
- **How it fits together:** Decisions prevent knowledge loss and provide context for future development

**Research (docs/research/)**
- **Purpose:** Build and preserve knowledge about concepts, the codebase, and how components fit together
- **How it fits together:** Research provides the context needed to make informed decisions and write accurate specs

**Plans (docs/plans/)**
- **Purpose:** Plan and coordinate implementation work, breaking down complex tasks into manageable steps
- **How it fits together:** Plans ensure work is done in the right order and with proper verification

**Retrospectives (docs/retro/)**
- **Purpose:** Capture lessons learned and process improvements after completing work
- **How it fits together:** Retrospectives feed back into decisions, research, and specs to improve future work

**Readme Files:**
- [Specs README](./docs/specs/README.md)
- [Design README](./docs/design/README.md)
- [Decisions README](./docs/decisions/README.md)
- [Research README](./docs/research/README.md)
- [Plans README](./docs/plans/README.md)
- [Retrospectives README](./docs/retro/README.md)

**Workflow:**
1. Research concepts and context → 2. Write specs defining requirements → 3. Make decisions about implementation → 4. Create plans for the work → 5. Implement → 6. Retrospect and improve → 7. Update research and specs

This cycle ensures each area serves its purpose and the system as a whole improves continuously.