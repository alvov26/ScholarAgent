# Frontend Tests

This directory contains all frontend tests for Scholar Agent.

## Quick Start

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Interactive UI
npm run test:ui

# Coverage report
npm run test:coverage
```

## Current Test Coverage

✅ **20 tests passing**

### Components
- ✅ HTMLRenderer (11 tests)

### Hooks
- ✅ useTooltips (9 tests)

## Directory Structure

```
__tests__/
├── setup.ts              # Test environment configuration
├── unit/                 # Unit tests for components and hooks
│   ├── HTMLRenderer.test.tsx
│   └── useTooltips.test.ts
└── integration/          # Integration tests (coming soon)
```

## Writing New Tests

See `../TESTING.md` for a comprehensive guide on:
- Writing component tests
- Testing hooks
- Mocking dependencies
- Best practices
- Debugging tips

## Example Test

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from '@/components/MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

## CI/CD

Tests run automatically on every commit and pull request. Ensure all tests pass before merging.

## Troubleshooting

**Issue**: Tests fail with "Cannot find module '@/...'"
**Solution**: Check that `vitest.config.ts` has the correct path alias configured.

**Issue**: "act(...)" warnings
**Solution**: Wrap async assertions in `waitFor()`:
```ts
await waitFor(() => {
  expect(result.current.data).toBeDefined()
})
```

For more help, see `../TESTING.md`.
