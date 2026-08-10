# AGENTS.md

## Core Principles

**Naintain a mental model:** any system can be expressed as a graph that depics how and why parts of the system relate to each other. The graph representation helps to understand and traverse complex systems efficiently.
**Maintain consistency:** keep documentation and implementation consistent. Always update documentation before implementation. Review all affected artifacts again after implementation and align them.

## Work Principles

### Specify

- **Specify requirements:** Write down requirements below `docs/specs/` folder. The specification serves as neutral basis to build a shared understanding of the upcoming changes, as well as building up factual domain knowledge, so that human and agent can reason about and iterate on the requirement in order to refine and find the most suitable solution and lock in facts. The requirements do not yet define any target technology if not explicitly requested from the operator.
- **Design and decide:** based on the specs, design documents are created  below `docs/design/` folder. The design locks in architecture and tech stack for the given requirement. 
- **Track decisions;** All decisions that human and agents make,must be tracked in`docs/decision/` folder and referenced in design docs where the decision is applied. Each desicion must provide context, outcome, rational and consequences. The decision must link the design documents that required the decision. Keep a decision index file up-to-date as short reference for finding decisions quickly.

### Research

- **Build context first:** Before starting any work, gather and understand the required concepts, surrounding codebase, project conventions, and related tasks. Always cite sources.
- **Verify before assuming:** Always confirm facts through inspection; do not make assumptions.
- **Preserve context:** When building up context from research and inspection, store facts, concepts and how things fit together as makrdown file below `docs/research` folder. Research documentation must be comprehensible And consice, so that future sessions can continue working without knowledge gap. Do not write verbose docs. Use Mermaid diagrams to convey complex systems and processes.

### Plan

- **Plan before acting:** Always identify next steps and their prerequisites before making any changes.
- **Document plan:** When you are tasked with a complex requirement, write down all your planning work into a markdown file in `plans/` folder. Link all dependent specs and reseach documents.
- **Track plans:** When creating a plan, add it to `docs/plans/index.md`, reference the plan file along a short title of the planned task, as well as the status of the task (review | in progress | done). The plan index must be kept up to date.
- **Decompose complex plans:** Complex tasks need to be broken down into small verifiable steps, so that issues surface early.
- **Compose dependency graph:** Complex decomposed tasks need to be brought into a logical order for implementation. Design a direct acyclic dependency graph as a Mermaid diagram in the plan file.
- **No arbitrary estimates:** Do not include speculative or unverified estimates in documentation.
- **Plan with existing behavior in mind:** When planning changes, consider how they will affect existing functionality and ensure your plans preserve current behavior unless updates are explicitly required.
- **Consider verification:** When planning work, always consider the success criteria and how the work will be verified.

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

- **Retrospect on conclusion:** When concluding work, do a retrospection, summarize the Achievements, list Impediments and Pitfalls, document learnings And ways to improve. link corresponding plan. Store your retrospection as markdown below `docs/retro/` folder. Extract reusable scripts for complex tasks where probability of doing it again is high. Update facts and documentation, when new insights were made or new truths discovered.

### Self-Improve

- **Consolidate learnings:** review past retrospectives, identify reoccuring patterns and issues. distill knowledge, solutions, workflows and automations, in order to handle known situations faster with increased determinism.