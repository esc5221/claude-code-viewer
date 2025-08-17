import { describe, it, expect, beforeEach, vi } from 'vitest'
import { existsSync } from 'fs'
import path from 'path'
import { resolveProjectPath, clearPathCache } from '../electron/pathResolver'

// Mock fs.existsSync to control file system behavior in tests
vi.mock('fs', () => ({
  existsSync: vi.fn()
}))

const mockExistsSync = vi.mocked(existsSync)

describe('pathResolver', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearPathCache()
    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('resolveProjectPath', () => {
    it('should handle empty input', () => {
      mockExistsSync.mockReturnValue(false)
      const result = resolveProjectPath('')
      expect(result).toBe('/')
    })

    it('should handle paths that are already in correct format', () => {
      const result = resolveProjectPath('/home/user/project')
      expect(result).toBe('/home/user/project')
    })

    describe('Unix path scenarios (/ separator)', () => {
      it('should handle simple Unix paths with existing directories', () => {
        mockExistsSync.mockImplementation((path: string) => {
          const pathStr = String(path)
          return pathStr.includes('/home') ||
                 pathStr.includes('/home/davidwei') ||
                 pathStr.includes('/home/davidwei/bin')
        })

        const result = resolveProjectPath('-home-davidwei-bin', path.posix)
        expect(result).toBe('/home/davidwei/bin')
      })

      it('should handle underscore detection in Unix paths', () => {
        mockExistsSync.mockImplementation((path: string) => {
          const pathStr = String(path)
          // Only the underscore version exists, not the slash version
          return pathStr === '/home/davidwei/AndroidStudioProjects/happy_notes' ||
                 pathStr === '/home/davidwei/AndroidStudioProjects' ||
                 pathStr === '/home/davidwei' ||
                 pathStr === '/home' ||
                 pathStr === '/'
        })

        const result = resolveProjectPath('-home-davidwei-AndroidStudioProjects-happy-notes', path.posix)
        expect(result).toBe('/home/davidwei/AndroidStudioProjects/happy_notes')
      })

      it('should fallback to dash separation when directories do not exist', () => {
        mockExistsSync.mockReturnValue(false)
        const result = resolveProjectPath('-home-someuser-unknown-project', path.posix)
        expect(result).toBe('/home/someuser/unknown/project')
      })
    })

    describe('Windows path scenarios (\\ separator)', () => {
      it('should handle basic Windows paths without file existence checking', () => {
        mockExistsSync.mockReturnValue(false)
        const result = resolveProjectPath('C--Users-David-Wei-bin', path.win32)
        expect(result).toBe('C:\\Users\\David\\Wei\\bin')
      })

      it('should prefer David.Wei when that directory exists', () => {
        mockExistsSync.mockImplementation((path: string) => {
          const pathStr = String(path)
          // Match actual path format from algorithm (no C: prefix during processing)
          return pathStr === '\\Users\\David.Wei' ||
                 pathStr === '\\Users\\David.Wei\\bin' ||
                 pathStr === '\\Users' ||
                 pathStr === '\\'
        })

        const result = resolveProjectPath('C--Users-David-Wei-bin', path.win32)
        expect(result).toBe('C:\\Users\\David.Wei\\bin')
      })

      it('should prefer David\\Wei when that directory structure exists', () => {
        mockExistsSync.mockImplementation((path: string) => {
          const pathStr = String(path)
          // Match actual path format: only David\Wei version exists
          return pathStr === '\\Users\\David' ||
                 pathStr === '\\Users\\David\\Wei' ||
                 pathStr === '\\Users\\David\\Wei\\bin' ||
                 pathStr === '\\Users' ||
                 pathStr === '\\'
        })

        const result = resolveProjectPath('C--Users-David-Wei-bin', path.win32)
        expect(result).toBe('C:\\Users\\David\\Wei\\bin')
      })

      it('should handle HappyNotes.Api when that directory exists', () => {
        mockExistsSync.mockImplementation((path: string) => {
          const pathStr = String(path)
          // Match actual path format: both David.Wei and HappyNotes.Api exist
          return pathStr === '\\' ||
                 pathStr === '\\Users' ||
                 pathStr === '\\Users\\David.Wei' ||
                 pathStr === '\\Users\\David.Wei\\RiderProjects' ||
                 pathStr === '\\Users\\David.Wei\\RiderProjects\\HappyNotes.Api'
        })

        const result = resolveProjectPath('C--Users-David-Wei-RiderProjects-HappyNotes-Api', path.win32)
        expect(result).toBe('C:\\Users\\David.Wei\\RiderProjects\\HappyNotes.Api')
      })

      it('should use cache for repeated calls', () => {
        mockExistsSync.mockReturnValue(false)

        const result1 = resolveProjectPath('C--Users-test', path.win32)
        const result2 = resolveProjectPath('C--Users-test', path.win32)

        expect(result1).toBe(result2)
        expect(result1).toBe('C:\\Users\\test')
      })

      it('should preserve original hyphen directories when they actually exist', () => {
        mockExistsSync.mockImplementation((path: string) => {
          const pathStr = String(path)
          // Only the original David-Wei directory exists (not David.Wei or David\Wei)
          return pathStr === '\\Users\\David-Wei' || 
                 pathStr === '\\Users\\David-Wei\\bin' ||
                 pathStr === '\\Users' ||
                 pathStr === '\\'
        })

        const result = resolveProjectPath('C--Users-David-Wei-bin', path.win32)
        expect(result).toBe('C:\\Users\\David-Wei\\bin')
      })
    })

    describe('Unix path edge cases', () => {
      it('should preserve original hyphen directories in Unix paths when they exist', () => {
        mockExistsSync.mockImplementation((path: string) => {
          const pathStr = String(path)
          // Only the original happy-notes directory exists (not happy_notes)
          return pathStr === '/home/davidwei/AndroidStudioProjects/happy-notes' ||
                 pathStr === '/home/davidwei/AndroidStudioProjects' ||
                 pathStr === '/home/davidwei' ||
                 pathStr === '/home' ||
                 pathStr === '/'
        })

        const result = resolveProjectPath('-home-davidwei-AndroidStudioProjects-happy-notes', path.posix)
        expect(result).toBe('/home/davidwei/AndroidStudioProjects/happy-notes')
      })
    })
  })

})