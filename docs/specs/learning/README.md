# Learning Core Specifications

The learning core provides Bob's ability to acquire, refine, and transfer knowledge across diverse domains.

## Components

| Spec | File | Description |
|------|------|-------------|
| Self-Supervised Learning | [self-supervised.md](self-supervised.md) | Unsupervised pattern extraction, embedding models, contrastive learning |
| Reinforcement Learning | [reinforcement.md](reinforcement.md) | Reward prediction, exploration strategies, multi-agent RL |
| Online/Incremental Learning | [online-learning.md](online-learning.md) | Continual learning, experience replay, parameter-efficient fine-tuning |
| Transfer Learning | [transfer-learning.md](transfer-learning.md) | Domain adaptation, multi-task learning, knowledge distillation |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Learning Core                          │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Self-Supervised│ Reinforcement│ Online Learning │ Transfer   │
│   Learning    │   Learning   │   Learning    │   Learning  │
└──────────────┴──────────────┴──────────────┴────────────┘
         │            │           │              │
         └───────────┴───────────┴──────────────┘
                         │
              ┌──────────▼─────────┐
              │  Shared Resources  │
              │  - Model Registry  │
              │  - Data Pipeline   │
              │  - Evaluation Suite│
              └───────────────────┘
```

## Learning Loop

```
1. Perceive → 2. Learn → 3. Evaluate → 4. Adapt → 5. Replay
   └─────────────────────────────────────────┐
                                              │
                                              ▼
                                    Self-Supervision
```

## Cross-Spec Dependencies

- **Online Learning** depends on **Self-Supervised Learning** for representation refinement
- **Transfer Learning** leverages **Reinforcement Learning** reward models
- **All specs** share **Evaluation** infrastructure from the evaluation domain

## Success Metrics

- Sample complexity improvements vs. SOTA methods
- Knowledge retention over time (forgetting curves)
- Cross-domain transfer success rates
- Learning rate tracking (improvement per environment step)
