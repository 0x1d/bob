# Human-in-the-Loop Specifications

The human-in-the-loop modules enable Bob to incorporate human feedback, communicate effectively with users, and align with human values.

## Components

| Spec | File | Description |
|------|------|-------------|
| User Feedback | [feedback.md](feedback.md) | Explicit/implicit feedback processing, preference learning, calibration |
| Communication | [communication.md](communication.md) | Dialogue management, query formulation, explanations, collaboration |
| Value Alignment | [value-alignment.md](value-alignment.md) | Value extraction, preference alignment, bias mitigation, cultural awareness |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Human-in-the-Loop                              │
├──────────────┬──────────────┬──────────────┬────────────┤
│ User Feedback │ Communication │ Value Alignment │ User Model  │
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

- **User Feedback** depends on **Communication** for feedback solicitation
- **Communication** depends on **Episodic Memory** for dialogue history
- **Value Alignment** depends on **Semantic Memory** for value concepts
- **User Model** depends on **All memories** for user profiling

## Success Metrics

- **User Feedback:** Explicit feedback accuracy ≥90%, preference learning F1 ≥0.85
- **Communication:** Dialogue coherence ≥85%, explanation quality ≥80%
- **Value Alignment:** Value extraction accuracy ≥80%, cultural sensitivity ≥85%
