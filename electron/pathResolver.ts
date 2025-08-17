import { existsSync } from 'fs'
import path from 'path'
const { join, resolve, sep } = path

// Map for caching
const pathCache = new Map<string, string>()

/**
 * Restore Claude project folder name to actual file system path
 * Example: -Users-lullu-mainpy-claude-code-web → /Users/lullu/mainpy/claude-code-web
 * Windows: C--Users-username-project → C:\Users\username\project
 *
 * Algorithm:
 * - Windows: Extract drive letter and replace '--' with '\'
 * - Unix: Start by replacing the first '-' with path separator, then for each '-',
 *   check if directory exists when replaced with path separator
 */
export function resolveProjectPath(projectName: string, pathImpl: typeof path = path): string {
  // Check cache
  if (pathCache.has(projectName)) {
    return pathCache.get(projectName)!
  }

  // Empty string or only '-' case
  if (!projectName || projectName === '-') {
    const result = pathImpl.resolve(pathImpl.sep)
    pathCache.set(projectName, result)
    return result
  }

  // Check if this is a Windows project folder (starts with drive letter)
  const isWindowsProjectFolder = /^[A-Za-z]--/.test(projectName)

  // Handle paths that are already in correct format (not encoded)
  if (!projectName.startsWith('-') && !isWindowsProjectFolder) {
    pathCache.set(projectName, projectName)
    return projectName
  }

  // Handle Windows project folders by converting them to Unix-like format for processing
  let workingProjectName = projectName
  let drivePrefix = ''

  if (isWindowsProjectFolder) {
    const driveMatch = projectName.match(/^([A-Za-z])--(.+)$/)
    if (driveMatch) {
      const [, driveLetter, pathPart] = driveMatch
      drivePrefix = `${driveLetter.toUpperCase()}:`
      workingProjectName = `-${pathPart}` // Convert to Unix-like format for processing
    }
  }

  // Array to construct result path
  const parts: string[] = []

  // Remove first '-' as it represents root
  let remaining = workingProjectName.substring(1)

  // Handle empty directory names (starting with --)
  while (remaining.startsWith('-')) {
    // Consecutive '-' means empty directory
    parts.push('')
    remaining = remaining.substring(1)
  }

  // Path constructed so far - start with root path using pathImpl
  let currentPath: string = pathImpl.sep

  while (remaining.length > 0) {
    // Find next '-' position
    let nextDashIndex = remaining.indexOf('-')

    if (nextDashIndex === -1) {
      // If no more '-', treat the rest as one part
      parts.push(remaining)
      currentPath = pathImpl.join(currentPath, remaining)
      break
    }

    // Check path when '-' is replaced with path separator
    const possiblePart = remaining.substring(0, nextDashIndex)
    const possiblePathAsSlash = pathImpl.join(currentPath, possiblePart)

    // Also check path when '-' is replaced with '_'
    const possiblePathAsUnderscore = pathImpl.join(currentPath, possiblePart.replace(/-/g, '_'))

    // NEW: Also check path when '-' is replaced with '.'
    const possiblePathAsDot = pathImpl.join(currentPath, possiblePart.replace(/-/g, '.'))

    // Resolve paths to handle Windows drive letters and normalize
    const resolvedPathAsSlash = pathImpl.resolve(possiblePathAsSlash)
    const resolvedPathAsUnderscore = pathImpl.resolve(possiblePathAsUnderscore)
    const resolvedPathAsDot = pathImpl.resolve(possiblePathAsDot)

    if (existsSync(resolvedPathAsSlash)) {
      // If directory exists, separate with path separator
      parts.push(possiblePart)
      currentPath = possiblePathAsSlash
      remaining = remaining.substring(nextDashIndex + 1)
    } else if (existsSync(resolvedPathAsUnderscore)) {
      // If exists when replaced with '_', process with '_'
      parts.push(possiblePart.replace(/-/g, '_'))
      currentPath = possiblePathAsUnderscore
      remaining = remaining.substring(nextDashIndex + 1)
    } else if (existsSync(resolvedPathAsDot)) {
      // NEW: If exists when replaced with '.', process with '.'
      parts.push(possiblePart.replace(/-/g, '.'))
      currentPath = possiblePathAsDot
      remaining = remaining.substring(nextDashIndex + 1)
    } else {
      // If directory doesn't exist, include up to next '-' as one part
      // Example: claude-code-web case
      let foundValid = false
      let searchIndex = nextDashIndex + 1

      while (searchIndex < remaining.length) {
        const nextSearchIndex = remaining.indexOf('-', searchIndex)
        if (nextSearchIndex === -1) {
          // Search to the end
          const testPart = remaining
          const testPath = pathImpl.join(currentPath, testPart)
          const testPartWithUnderscore = testPart.replace(/-/g, '_')
          const testPathWithUnderscore = pathImpl.join(currentPath, testPartWithUnderscore)
          const testPartWithDot = testPart.replace(/-/g, '.')
          const testPathWithDot = pathImpl.join(currentPath, testPartWithDot)

          // Resolve paths for Windows compatibility
          const resolvedTestPath = pathImpl.resolve(testPath)
          const resolvedTestPathWithUnderscore = pathImpl.resolve(testPathWithUnderscore)
          const resolvedTestPathWithDot = pathImpl.resolve(testPathWithDot)

          if (existsSync(resolvedTestPath)) {
            parts.push(testPart)
            currentPath = testPath
            remaining = ''
            foundValid = true
          } else if (existsSync(resolvedTestPathWithUnderscore)) {
            parts.push(testPartWithUnderscore)
            currentPath = testPathWithUnderscore
            remaining = ''
            foundValid = true
          } else if (existsSync(resolvedTestPathWithDot)) {
            parts.push(testPartWithDot)
            currentPath = testPathWithDot
            remaining = ''
            foundValid = true
          }
          break
        }

        // Test including up to next '-'
        const testPart = remaining.substring(0, nextSearchIndex)
        const testPath = pathImpl.join(currentPath, testPart)

        // Also test path with '_'
        const testPartWithUnderscore = testPart.replace(/-/g, '_')
        const testPathWithUnderscore = pathImpl.join(currentPath, testPartWithUnderscore)

        // Also test path with '.'
        const testPartWithDot = testPart.replace(/-/g, '.')
        const testPathWithDot = pathImpl.join(currentPath, testPartWithDot)

        // Resolve paths for Windows compatibility
        const resolvedTestPath = pathImpl.resolve(testPath)
        const resolvedTestPathWithUnderscore = pathImpl.resolve(testPathWithUnderscore)
        const resolvedTestPathWithDot = pathImpl.resolve(testPathWithDot)

        if (existsSync(resolvedTestPath)) {
          parts.push(testPart)
          currentPath = testPath
          remaining = remaining.substring(nextSearchIndex + 1)
          foundValid = true
          break
        } else if (existsSync(resolvedTestPathWithUnderscore)) {
          parts.push(testPartWithUnderscore)
          currentPath = testPathWithUnderscore
          remaining = remaining.substring(nextSearchIndex + 1)
          foundValid = true
          break
        } else if (existsSync(resolvedTestPathWithDot)) {
          parts.push(testPartWithDot)
          currentPath = testPathWithDot
          remaining = remaining.substring(nextSearchIndex + 1)
          foundValid = true
          break
        }

        searchIndex = nextSearchIndex + 1
      }

      if (!foundValid) {
        // If directory doesn't exist, fall back to treating first part as directory
        parts.push(possiblePart)
        currentPath = pathImpl.join(currentPath, possiblePart)
        remaining = remaining.substring(nextDashIndex + 1)
      }
    }
  }

  // Use the currentPath as the result since it's already built correctly
  let result = currentPath

  // For Windows paths, add drive prefix
  if (drivePrefix) {
    // Add drive prefix (path already uses correct separator)
    result = drivePrefix + result
  }

  // Save to cache
  pathCache.set(projectName, result)

  return result
}

/**
 * Clear cache
 */
export function clearPathCache(): void {
  pathCache.clear()
}

/**
 * Check cache status (for debugging)
 */
export function getPathCacheSize(): number {
  return pathCache.size
}

/**
 * Get cached path for specific project (for debugging)
 */
export function getCachedPath(projectName: string): string | undefined {
  return pathCache.get(projectName)
}

