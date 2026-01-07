---
description: 'Specification-Driven Workflow v1 provides a structured approach to software development, ensuring that requirements are clearly defined, designs are meticulously planned, and implementations are thoroughly documented and validated.'
applyTo: '**'
---

# Spec-Driven Workflow — Quick Loop

**Context:** This workflow integrates with the Memory Bank system.
- Requirements: `memory/requirements.md` (or relevant active document)
- Design: `memory/designs/design.md` (architecture, interfaces, diagrams)
- Tasks: `memory/tasks/_index.md` and `memory/tasks/TASKID-*.md`
- Active context: `memory/activeContext.md`, `memory/progress.md`

Receipt: "Follow a 6-phase spec-driven loop: Analyze → Design → Implement → Validate → Reflect → Handoff."

6-phase micro-plan:
- **Analyze**: Gather facts, write 2–5 EARS-style requirements.
- **Design**: Write a short design (diagram + interfaces) and create task files in `memory/tasks/`.
- **Implement**: Code in small increments, test, and update task files.
- **Validate**: Run automated tests, manual checks, and performance verifications.
- **Reflect**: Refactor, update docs, and record technical debt.
- **Handoff**: Prepare PR with executive summary, changelog, tests, and artifacts.

## Detailed Phase Checklist

### Phase 1: ANALYZE
- [ ] Write 2–5 testable requirements (EARS format: WHEN <event>, THE SYSTEM SHALL <behavior>).
- [ ] Determine Confidence Score.

### Phase 2: DESIGN
- [ ] **Low/Medium Confidence**: Build PoC/MVP first.
- [ ] **High Confidence**: Draft full plan.
- [ ] Create Design Doc (`memory/designs/design.md`) with Architecture, Data Flow, Interfaces, Data Models.
- [ ] Create Task Files:
    - Update `memory/tasks/_index.md`.
    - Create `memory/tasks/TASKID-taskname.md`.

### Phase 3: IMPLEMENT
- [ ] Code in small, testable increments.
- [ ] Update task status in `memory/tasks/TASKID-taskname.md` and `_index.md`.
- [ ] Add meaningful comments focused on intent.

### Phase 4: VALIDATE
- [ ] Execute automated tests (`pnpm test`, `pnpm e2e`).
- [ ] Perform manual verification.
- [ ] Test edge cases and errors.

### Phase 5: REFLECT
- [ ] Refactor for maintainability.
- [ ] Update all project documentation (READMEs, memory files).
- [ ] Auto-create technical debt issues if necessary.

### Phase 6: HANDOFF
- [ ] Generate executive summary.
- [ ] Prepare Pull Request with summary, changelog, and validation evidence.

## Templates

**EARS (Easy Approach to Requirements Syntax):**
`WHEN <event>, THE SYSTEM SHALL <behavior> [Acceptance: how to test]`

**PR Summary:**
1) Goal: <one-line>
2) Key changes: <files/functions>
3) Validation: <tests/metrics>

End.
