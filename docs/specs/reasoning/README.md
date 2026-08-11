# Reasoning & Planning Specifications

The reasoning and planning modules enable Bob to perform logical reasoning, solve problems, plan multi-step actions, and understand causal relationships.

## Components

| Spec | File | Description |
|------|------|-------------|
| Logical Reasoning | [logical.md](logical.md) | First-order logic, deduction, induction, abduction |
| Problem Solving | [problem-solving.md](problem-solving.md) | Task decomposition, search strategies, constraints |
| Strategic Planning | [strategic-planning.md](strategic-planning.md) | Multi-step planning, goal hierarchy, meta-cognition |
| Causal Reasoning | [causal.md](causal.md) | Counterfactuals, intervention analysis, causal models |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Reasoning & Planning                       │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Logical Reasoning │ Problem Solving │ Strategic Planning │ Causal Reasoning │
└──────────────┴──────────────┴──────────────┴────────────┘
         │            │           │              │
         └───────────┴───────────┴──────────────┘
                         │
              ┌──────────▼─────────┐
              │  Knowledge Base   │
              │  - Semantic Memory │
              │  - Episodic Memory │
              │  - Procedural Memory│
              └───────────────────┘
```

## Cross-Spec Dependencies

- **Logical Reasoning** depends on **Semantic Memory** for knowledge representation
- **Problem Solving** depends on **Logical Reasoning** for constraint satisfaction
- **Strategic Planning** depends on **Problem Solving** for subproblem decomposition
- **Causal Reasoning** depends on **Strategic Planning** for counterfactual simulation
- **All specs** share **Memory Systems** for context and evidence

## Success Metrics

- **Logical:** Validity checking 100%, inference accuracy ≥95%
- **Problem Solving:** Constraint satisfaction ≥90%, solution quality ≥85%
- **Strategic Planning:** Plan success rate ≥75%, replanning frequency <10%
- **Causal Reasoning:** Counterfactual accuracy ≥80%, causal model F1 ≥0.75
