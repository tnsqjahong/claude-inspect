import type { Page } from 'playwright';
import type { InspectedElement, ComponentTreeNode } from './types.js';
declare class ElementInspector {
    inspectElement(page: Page, selector: string): Promise<InspectedElement>;
    getComponentTree(page: Page, selector?: string, maxDepth?: number): Promise<ComponentTreeNode[]>;
}
export declare const elementInspector: ElementInspector;
export {};
