# Copilot Instructions Blueprint Generator

## Configuration Variables

- PROJECT_TYPE: TypeScript
- VERSIONING: Semantic
- CODE_QUALITY_FOCUS: Performance, Testability, Security, Accessibility
- TESTING_REQUIREMENTS: Unit, Integration, E2E, TDD, BDD
- DOCUMENTATION_LEVEL: Standard
- PERSISTENCE_TYPE: File system, External API
- ENTRY_POINT: Auto-detect

## Generated Prompt

### 1. Core Instruction Structure

- Detect and adhere to the specific ECMAScript/TypeScript version in use
- Follow the same module import/export patterns found in the codebase
- Match TypeScript type definitions with existing patterns
- Use the same async patterns (promises, async/await) as existing code
- Follow error handling patterns from similar files
- Limit function complexity and length to match existing patterns

### Performance

- Follow existing patterns for memory and resource management
- Match existing patterns for handling computationally expensive operations
- Follow established patterns for asynchronous operations
- Apply caching consistently with existing patterns
- Optimize according to patterns evident in the codebase

### Testability

- Follow established patterns for testable code
- Match dependency injection approaches used in the codebase
- Apply the same patterns for managing dependencies
- Follow established mocking and test double patterns
- Match the testing style used in existing tests

### Security

- Follow existing patterns for input validation
- Apply the same sanitization techniques used in the codebase
- Use parameterized queries matching existing patterns
- Follow established authentication and authorization patterns
- Handle sensitive data according to existing patterns

### Accessibility

- Follow existing accessibility patterns in the codebase
- Match ARIA attribute usage with existing components
- Maintain keyboard navigation support consistent with existing code
- Follow established patterns for color and contrast
- Apply text alternative patterns consistent with the codebase

### Integration Testing

- Follow the same integration test patterns found in the codebase
- Match existing patterns for test data setup and teardown
- Use the same approach for testing component interactions
- Follow existing patterns for verifying system behavior

### End-to-End Testing

- Match the existing E2E test structure and patterns
- Follow established patterns for UI testing
- Apply the same approach for verifying user journeys

### Test-Driven Development

- Follow TDD patterns evident in the codebase
- Match the progression of test cases seen in existing code
- Apply the same refactoring patterns after tests pass

### Behavior-Driven Development

- Match the existing Given-When-Then structure in tests
- Follow the same patterns for behavior descriptions
- Apply the same level of business focus in test cases

### Documentation Requirements

- Follow the exact documentation format found in the codebase
- Document according to patterns observed in the codebase
- Use the same format for parameter descriptions as existing code
- Document non-obvious behavior and edge cases

### Technology-Specific Guidelines

- Detect and adhere to the specific ECMAScript/TypeScript version in use
- Follow the same module import/export patterns found in the codebase
- Match TypeScript type definitions with existing patterns
- Use the same async patterns (promises, async/await) as existing code
- Follow error handling patterns from similar files

## Version Control Guidelines

- Follow Semantic Versioning patterns as applied in the codebase
- Match existing patterns for documenting breaking changes
- Follow the same approach for deprecation notices

## Workflow Documentation Instructions

- Document the message handler class and method
- Show message subscription configuration
- Include the complete message model definition
- Show deserialization and validation logic
- Show the event handler that triggers the request
- Include the API client service method
- Show state management code related to the request
- Focus on file system and external API interactions

## Output Format

- Structured markdown documentation
- Blueprint-style instructions for Copilot automation
- Clear, actionable steps for implementation
- Examples and templates for common tasks

## Success Criteria

- Instructions match codebase patterns
- Output is clear, actionable, and maintainable
- Documentation is comprehensive and easy to follow
- Automation steps are reliable and extensible
