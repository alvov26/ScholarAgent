import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTooltips } from '@/hooks/useTooltips'

// Mock the fetch API
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock API_BASE
vi.mock('@/hooks/useApi', () => ({
  API_BASE: 'http://localhost:8000',
  apiFetch: async (url: string) => {
    const response = await fetch(`http://localhost:8000${url}`)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw error
    }
    return response.json()
  }
}))

describe('useTooltips', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches tooltips on mount when paperId is provided', async () => {
    const mockTooltips = [
      {
        id: 'tooltip-1',
        paper_id: 'paper-123',
        dom_node_id: 'node-1',
        user_id: 'default',
        content: 'Test tooltip 1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTooltips
    })

    const { result } = renderHook(() => useTooltips('paper-123'))

    // Initially loading
    expect(result.current.loading).toBe(true)

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/papers/paper-123/tooltips')
    expect(result.current.tooltips).toEqual(mockTooltips)
    expect(result.current.error).toBe(null)
  })

  it('does not fetch tooltips when paperId is null', async () => {
    const { result } = renderHook(() => useTooltips(null))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.tooltips).toEqual([])
  })

  it('builds tooltip map correctly', async () => {
    const mockTooltips = [
      {
        id: 'tooltip-1',
        paper_id: 'paper-123',
        dom_node_id: 'node-1',
        user_id: 'default',
        content: 'Tooltip for node 1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'tooltip-2',
        paper_id: 'paper-123',
        dom_node_id: 'node-1',
        user_id: 'default',
        content: 'Another tooltip for node 1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'tooltip-3',
        paper_id: 'paper-123',
        dom_node_id: 'node-2',
        user_id: 'default',
        content: 'Tooltip for node 2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTooltips
    })

    const { result } = renderHook(() => useTooltips('paper-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.tooltipMap['node-1']).toHaveLength(2)
    expect(result.current.tooltipMap['node-2']).toHaveLength(1)
  })

  it('creates a new tooltip', async () => {
    const mockExistingTooltips: any[] = []
    const mockNewTooltip = {
      id: 'new-tooltip',
      paper_id: 'paper-123',
      dom_node_id: 'node-1',
      user_id: 'default',
      content: 'New tooltip content',
      target_text: 'Selected text',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockExistingTooltips
    })

    const { result } = renderHook(() => useTooltips('paper-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Create tooltip
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNewTooltip
    })

    let newTooltip
    await act(async () => {
      newTooltip = await result.current.createTooltip('node-1', 'New tooltip content', 'Selected text')
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/papers/paper-123/tooltips',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dom_node_id: 'node-1',
          content: 'New tooltip content',
          target_text: 'Selected text'
        })
      })
    )

    expect(newTooltip).toEqual(mockNewTooltip)
    expect(result.current.tooltips).toContainEqual(mockNewTooltip)
  })

  it('updates an existing tooltip', async () => {
    const mockTooltips = [
      {
        id: 'tooltip-1',
        paper_id: 'paper-123',
        dom_node_id: 'node-1',
        user_id: 'default',
        content: 'Original content',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]

    const mockUpdatedTooltip = {
      ...mockTooltips[0],
      content: 'Updated content',
      updated_at: '2024-01-01T01:00:00Z'
    }

    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTooltips
    })

    const { result } = renderHook(() => useTooltips('paper-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Update tooltip
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUpdatedTooltip
    })

    let updated
    await act(async () => {
      updated = await result.current.updateTooltip('tooltip-1', 'Updated content')
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/papers/paper-123/tooltips/tooltip-1',
      expect.objectContaining({
        method: 'PUT'
      })
    )

    expect(updated?.content).toBe('Updated content')
    expect(result.current.tooltips[0].content).toBe('Updated content')
  })

  it('deletes a tooltip', async () => {
    const mockTooltips = [
      {
        id: 'tooltip-1',
        paper_id: 'paper-123',
        dom_node_id: 'node-1',
        user_id: 'default',
        content: 'To be deleted',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]

    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTooltips
    })

    const { result } = renderHook(() => useTooltips('paper-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.tooltips).toHaveLength(1)

    // Delete tooltip
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success' })
    })

    let deleted
    await act(async () => {
      deleted = await result.current.deleteTooltip('tooltip-1')
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/papers/paper-123/tooltips/tooltip-1',
      expect.objectContaining({
        method: 'DELETE'
      })
    )

    expect(deleted).toBe(true)
    expect(result.current.tooltips).toHaveLength(0)
  })

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Paper not found' })
    })

    const { result } = renderHook(() => useTooltips('paper-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Paper not found')
    expect(result.current.tooltips).toEqual([])
  })

  it('handles create errors gracefully', async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    })

    const { result } = renderHook(() => useTooltips('paper-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Create with error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Invalid content' })
    })

    let newTooltip
    await act(async () => {
      newTooltip = await result.current.createTooltip('node-1', '')
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(newTooltip).toBe(null)
    expect(result.current.error).toBe('Invalid content')
  })

  it('clears error when clearError is called', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Error occurred' })
    })

    const { result } = renderHook(() => useTooltips('paper-123'))

    await waitFor(() => {
      expect(result.current.error).toBe('Error occurred')
    })

    act(() => {
      result.current.clearError()
    })

    await waitFor(() => {
      expect(result.current.error).toBe(null)
    })
  })
})
