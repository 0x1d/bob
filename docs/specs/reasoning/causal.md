# Causal Reasoning Specification

## Overview

Causal reasoning enables Bob to understand and predict cause-effect relationships, reason about interventions and counterfactuals, and learn structural causal models from data.

## Requirements

### 9.1 Counterfactual Reasoning

- [ ] Counterfactual question answering
- [ ] Counterfactual intervention simulation
- [ ] Counterfactual policy evaluation
- [ ] Counterfactual outcome prediction
- [ ] Counterfactual explanation generation
- [ ] Counterfactual reasoning under uncertainty

### 9.2 Intervention Analysis (Do-Calculus)

- [ ] P-do formula identification
- [ ] Back-door criterion application
- [ ] Front-door criterion application
- [ ] Adjustment formula derivation
- [ ] Identities for causal inference
- [ ] Counterfactual identification

### 9.3 Correlation vs. Causation

- [ ] Causal discovery from observational data
- [ ] Causal graph learning (PC algorithm, FCI)
- [ ] Causal effect estimation
- [ ] Confounding bias correction
- [ ] Mediation analysis
- [ ] Causal effect heterogeneity

### 9.4 Structural Causal Model Learning

- [ ] SCM structure learning from data
- [ ] SCM parameter estimation
- [ ] SCM intervention simulation
- [ ] SCM counterfactual prediction
- [ ] SCM identification from data
- [ ] SCM learning with limited data

### 9.5 Causal Inference with Missing Data

- [ ] Missing at random (MAR) handling
- [ ] Missing not at random (MNAR) handling
- [ ] Multiple imputation for causal inference
- [ ] Causal inference with informative censoring
- [ ] Selection bias correction
- [ ] Causal inference with measurement error

### 9.6 Causal Discovery and Validation

- [ ] Causal discovery from time-series data
- [ ] Granger causality for temporal relationships
- [ ] Causal graph validation
- [ ] Causal effect validation
- [ ] Causal model refinement
- [ ] Causal model generalization

## Interfaces

### External Interfaces

**Causal Reasoner Interface:**

```
causal_reasoner {
  intervene(SCM: SCM, intervention: Intervention) -> SCM
  counterfactual(SCM: SCM, scenario: Scenario) -> Counterfactual
  identify_effect(data: Data) -> Effect
  discover_graph(data: Data) -> Graph
  identify_formula(data: Data, outcome: Outcome) -> Formula
}
```

**Counterfactual Schema:**

```
counterfactual {
  id: string                           // Counterfactual ID
  SCM: SCM                            // Structural causal model
  scenario: Scenario                  // Counterfactual scenario
  outcome: Outcome                    // Counterfactual outcome
  confidence: float                   // Confidence score
  assumptions: Assumption[]           // Causal assumptions
}
```

### Internal Interfaces

**Logical Reasoning:**
- Use logical reasoning for causal graph representation
- Deduce causal relationships logically
- Abduct causal explanations
- Validate causal relationships logically

**Problem Solving:**
- Use problem solving for causal discovery
- Decompose causal inference problems
- Solve causal effect estimation
- Optimize causal interventions

**Episodic Memory:**
- Retrieve counterfactual episodes
- Use causal episodes for counterfactual reasoning
- Generalize causal patterns
- Hypothesize causal explanations

**Semantic Memory:**
- Retrieve causal domain concepts
- Use knowledge for causal graph construction
- Verify causal relationships semantically
- Generalize causal patterns

**Reinforcement Learning:**
- Use causal reasoning for counterfactual RL
- Learn causal policies
- Apply causal reasoning for credit assignment
- Use causal models for reward shaping

**Perception:**
- Use perception for causal inference
- Ground perceptual data in causal models
- Use perception for counterfactual reasoning
- Abduct perceptual causes

## Data Contracts

### Structural Causal Model Schema

```
SCM {
  id: string                           // SCM ID
  variables: Variable[]                // SCM variables
  graph: Graph                        // SCM causal graph
  parameters: Parameter[]              // SCM parameters
  assumptions: Assumption[]            // SCM assumptions
}
```

### Intervention Schema

```
intervention {
  id: string                           // Intervention ID
  SCM: SCM                            // Target SCM
  variable: Variable                  // Intervened variable
  value: Value                         // Intervention value
  time: datetime                      // Intervention time
}
```

### Scenario Schema

```
scenario {
  id: string                           // Scenario ID
  SCM: SCM                            // Associated SCM
  counterfactuals: Counterfactual[]   // Counterfactuals in scenario
  time: datetime                      // Scenario time
}
```

### Causal Graph Schema

```
graph {
  id: string                           // Graph ID
  nodes: Variable[]                   // Graph nodes
  edges: Edge[]                       // Graph edges
  direction: string                   // Edge direction
  weight: float                       // Edge weight
}
```

## Success Criteria

1. **Counterfactual Reasoning**
   - Counterfactual answer accuracy ≥80%
   - Counterfactual intervention simulation accuracy ≥85%
   - Counterfactual policy evaluation accuracy ≥85%
   - Counterfactual outcome prediction accuracy ≥80%

2. **Intervention Analysis (Do-Calculus)**
   - P-do formula identification accuracy ≥90%
   - Back-door/front-door application accuracy ≥95%
   - Adjustment formula derivation accuracy ≥90%
   - Identities application accuracy ≥95%

3. **Correlation vs. Causation**
   - Causal discovery accuracy ≥85%
   - Causal effect estimation accuracy ≥80%
   - Confounding bias correction accuracy ≥85%
   - Mediation analysis accuracy ≥80%

4. **Structural Causal Model Learning**
   - SCM structure learning accuracy ≥85%
   - SCM parameter estimation accuracy ≥80%
   - SCM intervention simulation accuracy ≥85%
   - SCM counterfactual prediction accuracy ≥80%

5. **Causal Inference with Missing Data**
   - MAR/MNAR handling accuracy ≥85%
   - Multiple imputation accuracy ≥80%
   - Informative censoring handling accuracy ≥85%
   - Selection bias correction accuracy ≥80%

6. **Causal Discovery and Validation**
   - Time-series causal discovery accuracy ≥80%
   - Granger causality accuracy ≥85%
   - Causal graph validation accuracy ≥90%
   - Causal model generalization accuracy ≥80%

## Open Questions

1. **Causal Discovery:** What is the optimal causal discovery algorithm for different data types?
2. **Counterfactual Reasoning:** How to reason about counterfactuals under limited data?
3. **Intervention Analysis:** How to identify valid adjustment sets in complex graphs?
4. **SCM Learning:** What is the optimal SCM learning algorithm with limited data?
5. **Causal vs. Correlational:** How to distinguish causal from correlational relationships in complex systems?

## References

- Pearl (2009). Causality: Models, Reasoning, and Inference
- Hernán & Robins (2020). Causal Inference
- Shpitser & Pearl (2006). Identifiability of Causal Effects in SEMs
- Spirtes et al. (2000). Causation, Discovery, and Causal Diagrams
- Peters et al. (2017). Elements of Causal Inference
- Robins (1986). A New Graphical Model for the Analysis of Observational Data
