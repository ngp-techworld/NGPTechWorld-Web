// Import for its side effects at the top of a slow test file. Whole forms are filled in and saved in one test, and the
// full suite runs many test files in parallel: give every test and every waitFor / findBy* more room than the defaults.
import { configure } from '@testing-library/react'
import { beforeAll, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 5_000 })

// The project page is lazy (ProjectEdit loads it on first use): transform it before the first test of the file, so its
// one-off cost is not charged to whichever test happens to open a project first.
beforeAll(() => import('./ProjectPage'), 30_000)
