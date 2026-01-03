# Aligned Instructions

This directory contains instruction files used to guide AI agents and developers on project standards, workflows, and best practices.

## File Manifest & Changes

### Core Technology Stack

*   **`nodejs-javascript-vitest.instructions.md`**
    *   **Purpose**: Guidelines for Node.js and JavaScript code, specifically focusing on Vitest for testing.
    *   **Changes**:
        *   Updated package manager from `npm` to `pnpm`.
        *   Removed legacy reference to "SpaceAutoBattler".
        *   Ensured alignment with `package.json` (Node 20+).

*   **`typescript-5-es2022.instructions.md`**
    *   **Purpose**: Best practices for TypeScript 5.x development targeting ES2022.
    *   **Changes**:
        *   Updated lint command to use `pnpm lint`.

*   **`reactjs.instructions.md`**
    *   **Purpose**: Standards for React application development (hooks, functional components, architecture).
    *   **Changes**:
        *   Verified alignment with current best practices (React 19+, functional components).

*   **`playwright-typescript.instructions.md`**
    *   **Purpose**: Guidelines for writing E2E tests with Playwright.
    *   **Changes**:
        *   Removed duplicate/malformed content at the end of the file.
        *   Updated example code to refer to generic paths or correct ports (aligned with `playwright.config.ts`).

### Workflows & Processes

*   **`memory-bank.instructions.md`**
    *   **Purpose**: definitive guide for the Memory Bank system (`/memory/`), including task tracking and context management.
    *   **Changes**: None required (served as the source of truth).

*   **`spec-driven-workflow-v1.instructions.md`**
    *   **Purpose**: A 6-phase workflow (Analyze -> Design -> Implement -> Validate -> Reflect -> Handoff).
    *   **Changes**:
        *   Heavily refactored to remove duplicate sections.
        *   Aligned file paths with the Memory Bank structure (`memory/tasks/` instead of root `tasks.md`).
        *   Consolidated checklists for clarity.

### Documentation & Best Practices

*   **`code-review-generic.instructions.md`**: General code review checklist.
*   **`github-actions-ci-cd-best-practices.instructions.md`**: Best practices for CI/CD workflows.
*   **`markdown.instructions.md`**: Style guide for Markdown files.
*   **`performance-optimization.instructions.md`**: General performance tips.
*   **`self-explanatory-code-commenting.instructions.md`**: Philosophy on code comments.
*   **`ai-prompt-engineering-safety-best-practices.instructions.md`**: AI interaction guidelines.
*   **`prompt.instructions.md`**: General prompt guidelines.
*   **`taming-copilot.instructions.md`**: Specifics for interacting with Copilot.

### Removed / Archived

*   **`powershell.instructions.md`**: Deleted. Irrelevant for this specific web/tech stack.
*   **`tasksync.instructions.md`**: Deleted. Legacy/External tool configuration not relevant to the current repository structure.

## Summary of Global Alignments

1.  **Package Manager**: Standardized on `pnpm` across all instructions and `AGENTS.md`.
2.  **Paths**: Aligned all references to task management to point to `memory/tasks/`.
3.  **Cleanup**: Removed irrelevant files and fixed malformed content.
