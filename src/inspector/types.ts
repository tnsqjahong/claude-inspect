export interface ElementInfo {
  tagName: string;
  id: string;
  classes: string[];
  attributes: Record<string, string>;
  styles: Record<string, string>;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textContent: string;
  selector: string;
}

export interface ComponentInfo {
  framework: string;
  componentName: string;
  sourceFile: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  props: Record<string, unknown>;
}

export interface InspectedElement {
  element: ElementInfo;
  component: ComponentInfo | null;
}

export interface ComponentTreeNode {
  name: string;
  framework: string;
  sourceFile: string | null;
  props: Record<string, unknown>;
  children: ComponentTreeNode[];
  depth: number;
}

export interface SourceLocation {
  filePath: string;
  lineNumber: number;
  columnNumber?: number;
}
