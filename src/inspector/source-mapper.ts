import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import type { SourceLocation } from './types.js';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.nuxt', '.output']);
const COMPONENT_EXTENSIONS = ['.tsx', '.jsx', '.vue', '.svelte', '.ts', '.js'];

class SourceMapper {
  private kebabCase(name: string): string {
    return name
      .replace(/([A-Z])/g, (match, letter, offset) =>
        offset === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`,
      )
      .replace(/--+/g, '-');
  }

  private candidateFileNames(componentName: string): string[] {
    const kebab = this.kebabCase(componentName);
    const names: string[] = [];
    for (const ext of COMPONENT_EXTENSIONS) {
      names.push(`${componentName}${ext}`);
      names.push(`${kebab}${ext}`);
    }
    return names;
  }

  private async findLineNumber(filePath: string, componentName: string): Promise<number> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n').slice(0, 50);
      const patterns = [
        new RegExp(`function\\s+${componentName}\\b`),
        new RegExp(`const\\s+${componentName}\\s*=`),
        new RegExp(`class\\s+${componentName}\\b`),
        /export\s+default/,
        new RegExp(`name:\\s*['"]${componentName}['"]`),
        new RegExp(`export\\s+function\\s+${componentName}\\b`),
      ];
      for (let i = 0; i < lines.length; i++) {
        for (const pattern of patterns) {
          if (pattern.test(lines[i])) {
            return i + 1;
          }
        }
      }
    } catch {
      // ignore read errors
    }
    return 1;
  }

  private async walkDir(
    dir: string,
    candidates: Set<string>,
    results: string[],
  ): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await this.walkDir(join(dir, entry.name), candidates, results);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (COMPONENT_EXTENSIONS.includes(ext) && candidates.has(entry.name)) {
          results.push(join(dir, entry.name));
        }
      }
    }
  }

  async findComponentSource(
    componentName: string,
    projectRoot: string,
  ): Promise<SourceLocation | null> {
    try {
      await stat(projectRoot);
    } catch {
      return null;
    }

    const candidateNames = this.candidateFileNames(componentName);
    const candidateSet = new Set(candidateNames);
    const matches: string[] = [];

    await this.walkDir(projectRoot, candidateSet, matches);

    if (matches.length === 0) {
      return null;
    }

    // Prefer exact PascalCase matches first
    const preferred =
      matches.find((m) => basename(m).startsWith(componentName)) ?? matches[0];

    const lineNumber = await this.findLineNumber(preferred, componentName);

    return {
      filePath: preferred,
      lineNumber,
    };
  }
}

export const sourceMapper = new SourceMapper();
