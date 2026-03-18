import type { SourceLocation } from './types.js';
declare class SourceMapper {
    private kebabCase;
    private candidateFileNames;
    private findLineNumber;
    private walkDir;
    findComponentSource(componentName: string, projectRoot: string): Promise<SourceLocation | null>;
}
export declare const sourceMapper: SourceMapper;
export {};
