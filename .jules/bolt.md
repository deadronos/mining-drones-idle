
## 2024-05-22 - WASM Mocking for Tests
**Learning:** When running tests that depend on WASM in a simulated environment (like Vitest/JSDOM), simply creating the file is not enough if the import chain expects a default export function that returns a Promise resolving to an object with a `memory` property.
**Action:** When mocking WASM modules for tests, ensure the mock export structure matches the expectation of the loader (e.g., `export default function() { return Promise.resolve({ memory: { buffer: new ArrayBuffer(1024) } }); }`).


## 2024-05-22 - React.memo and Hooks Mismatch
**Learning:** When extracting a component inside another component file and wrapping it in `React.memo`, ensure that it is defined at the top level of the file, not inside the parent component, to avoid hook mismatch errors during tests or renders.
**Action:** Define helper components like `LastSampleLabel` outside of the main export component.


## 2024-05-22 - "Rendered fewer hooks" Error
**Learning:** The error "Rendered fewer hooks than expected" often occurs when a component returns early (e.g., `if (!factoryId) return ...`) *before* hooks that are called later in the component body. Hooks must always be called in the same order and count on every render.
**Action:** Move all hook calls (like `useMemo`, `useStore`, etc.) to the top of the component, *before* any conditional return statements.


## 2024-05-22 - React.memo Display Name
**Learning:** `React.memo` components often trigger ESLint `react/display-name` errors because the inferred name is lost.
**Action:** Explicitly set `displayName` on memoized components (e.g., `MyComponent.displayName = "MyComponent";`) or use named functions inside `memo`.
