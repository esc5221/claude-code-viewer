/**
 * Convert a regular file system path to a Claude project folder name
 * Example: /Users/lullu/claude-work -> -Users-lullu-claude-work
 */
export function pathToProjectName(dirPath: string): string {
  return dirPath.replace(/\//g, '-').replace(/_/g, '-')
}

/**
 * Extract the project name from a full project path
 * Example: /Users/name/.claude/projects/-Users-lullu-claude-work -> -Users-lullu-claude-work
 */
export function getProjectNameFromPath(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1]
}

/**
 * Check if a project path matches a given directory path
 * This handles both full paths and project names
 */
export function isMatchingProject(projectPath: string, dirPath: string): boolean {
  // If projectPath is already a full path to .claude/projects
  if (projectPath.includes('.claude/projects')) {
    const projectName = getProjectNameFromPath(projectPath)
    const expectedName = pathToProjectName(dirPath)
    return projectName === expectedName
  }
  
  // Otherwise, compare directly
  return projectPath === dirPath
}

/**
 * Find a project from a list that matches the given directory path
 */
export function findMatchingProject(projects: Array<{ path: string, name: string }>, dirPath: string): any {
  return projects.find(project => isMatchingProject(project.path, dirPath))
}