# Frontend Testing Guide

This document describes how to write and run tests for the Scholar Agent frontend.

---

## Test Stack

- **Vitest**: Fast, modern test runner with ESM support
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: Custom matchers for DOM assertions
- **jsdom**: DOM implementation for Node.js

---

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with UI (interactive browser interface)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Advanced Options

```bash
# Run specific test file
npm test -- __tests__/unit/HTMLRenderer.test.tsx

# Run tests matching a pattern
npm test -- --grep "renders"

# Update snapshots (if using snapshot tests)
npm test -- -u
```

---

## Writing Tests

### Directory Structure

```
frontend/
├── __tests__/
│   ├── setup.ts              # Test environment setup
│   ├── unit/                 # Unit tests
│   │   ├── HTMLRenderer.test.tsx
│   │   └── useTooltips.test.ts
│   └── integration/          # Integration tests
│       └── PaperViewer.test.tsx
└── vitest.config.ts          # Vitest configuration
```

### Component Tests

Example: Testing a React component

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyComponent } from '@/components/MyComponent'

describe('MyComponent', () => {
  it('renders content correctly', () => {
    render(<MyComponent title="Hello" />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    render(<MyComponent onClick={handleClick} />)

    const button = screen.getByRole('button')
    await userEvent.click(button)

    expect(handleClick).toHaveBeenCalledOnce()
  })
})
```

### Hook Tests

Example: Testing a custom React hook

```ts
import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMyHook } from '@/hooks/useMyHook'

describe('useMyHook', () => {
  it('fetches data on mount', async () => {
    const { result } = renderHook(() => useMyHook('param'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeDefined()
  })
})
```

### Mocking

#### Mock a Module

```ts
vi.mock('@/components/SomeComponent', () => ({
  SomeComponent: ({ children }: any) => <div>Mocked Component: {children}</div>
}))
```

#### Mock fetch API

```ts
const mockFetch = vi.fn()
global.fetch = mockFetch

mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ data: 'test' })
})
```

#### Mock Next.js Router

```ts
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
  }),
  usePathname: () => '/',
}))
```

---

## Testing Best Practices

### 1. Test User Behavior, Not Implementation

**❌ Bad:**
```tsx
expect(component.state.isOpen).toBe(true)
```

**✅ Good:**
```tsx
expect(screen.getByRole('dialog')).toBeVisible()
```

### 2. Use Semantic Queries

Prefer queries that reflect how users interact:

```tsx
// Best - accessible to all users
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText('Email')

// OK - visible to users
screen.getByText('Click me')
screen.getByPlaceholderText('Search...')

// Avoid - implementation details
screen.getByTestId('submit-btn')
```

### 3. Wait for Async Updates

Always use `waitFor` for async operations:

```tsx
await waitFor(() => {
  expect(screen.getByText('Loaded!')).toBeInTheDocument()
})
```

### 4. Clean Up After Tests

Our setup automatically cleans up after each test. If you need custom cleanup:

```ts
import { afterEach } from 'vitest'

afterEach(() => {
  // Custom cleanup
  localStorage.clear()
})
```

### 5. Organize Tests by Feature

```tsx
describe('HTMLRenderer', () => {
  describe('when rendering math', () => {
    it('intercepts math tags', () => { ... })
    it('renders with MathJax', () => { ... })
  })

  describe('when rendering paragraphs', () => {
    it('makes them interactive', () => { ... })
    it('preserves data-id attributes', () => { ... })
  })
})
```

---

## Common Testing Patterns

### Testing API Calls

```ts
it('fetches data from API', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ tooltips: [] })
  })

  const { result } = renderHook(() => useTooltips('paper-123'))

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:8000/api/papers/paper-123/tooltips'
  )
})
```

### Testing Error States

```ts
it('displays error message on failure', async () => {
  mockFetch.mockRejectedValueOnce(new Error('Network error'))

  render(<MyComponent />)

  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument()
  })
})
```

### Testing Form Interactions

```tsx
it('submits form data', async () => {
  const user = userEvent.setup()
  const handleSubmit = vi.fn()

  render(<MyForm onSubmit={handleSubmit} />)

  await user.type(screen.getByLabelText('Name'), 'John')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  expect(handleSubmit).toHaveBeenCalledWith({ name: 'John' })
})
```

---

## Coverage Goals

- **Components**: Aim for 80%+ coverage
- **Hooks**: Aim for 90%+ coverage
- **Critical paths**: 100% coverage (tooltip creation, HTML rendering)

### Viewing Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/`:
- `coverage/index.html` - Visual HTML report
- `coverage/coverage-final.json` - JSON data

---

## Debugging Tests

### 1. Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### 2. Use `debug()` Utility

```tsx
import { render, screen } from '@testing-library/react'

it('debugging test', () => {
  const { debug } = render(<MyComponent />)

  // Print current DOM state
  debug()

  // Print specific element
  debug(screen.getByRole('button'))
})
```

### 3. Run Single Test

```bash
# Run only tests with "specific" in the name
npm test -- --grep "specific test name"
```

---

## CI/CD Integration

Tests run automatically in CI/CD pipelines. Ensure tests:

- Pass without warnings
- Complete within 60 seconds
- Don't require external services (mock them)
- Work in headless environments

---

## Troubleshooting

### Issue: "Cannot find module '@/...'"

**Solution**: Check `vitest.config.ts` has the correct alias:

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './')
  }
}
```

### Issue: "act(...) warnings"

These warnings appear when React state updates aren't wrapped in `act()`. Use `waitFor()`:

```tsx
await waitFor(() => {
  expect(result.current.data).toBeDefined()
})
```

### Issue: Tests timeout

Increase timeout in `vitest.config.ts`:

```ts
test: {
  testTimeout: 10000 // 10 seconds
}
```

---

## Next Steps

1. **Add more component tests**: Test `MathJaxNode`, `InteractiveNode`, etc.
2. **Add integration tests**: Test full user workflows
3. **Set up E2E tests**: Use Playwright for end-to-end testing
4. **CI/CD**: Add GitHub Actions to run tests on every PR

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
