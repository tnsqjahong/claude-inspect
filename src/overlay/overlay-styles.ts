export const OVERLAY_STYLES: string = `
.__cb-highlight {
  position: fixed;
  pointer-events: none;
  z-index: 2147483647;
  border: 2px solid #4A90D9;
  background: rgba(74, 144, 217, 0.1);
  transition: all 0.05s ease-out;
}

.__cb-tooltip {
  position: fixed;
  z-index: 2147483647;
  background: #1a1a2e;
  color: #e0e0e0;
  padding: 8px 12px;
  border-radius: 6px;
  font: 12px/1.4 'SF Mono', Monaco, Consolas, monospace;
  pointer-events: auto;
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  user-select: none;
  -webkit-user-select: none;
}

.__cb-tooltip-tail {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #1a1a2e;
  transform: rotate(45deg);
  z-index: -1;
}

.__cb-bridge {
  position: fixed;
  z-index: 2147483647;
  pointer-events: auto;
  display: none;
}

.__cb-send-btn {
  display: inline-block;
  background: #4A90D9;
  color: white;
  border: none;
  padding: 3px 10px;
  border-radius: 4px;
  font: 11px/1.4 -apple-system, sans-serif;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s;
}

.__cb-send-btn:hover {
  background: #357ABD;
}

.__cb-tooltip-component {
  color: #61dafb;
  font-weight: bold;
}

.__cb-tooltip-source {
  color: #98c379;
  font-size: 11px;
  margin-top: 2px;
}

.__cb-tooltip-dim {
  color: #888;
  font-size: 11px;
}

.__cb-selected {
  position: fixed;
  pointer-events: none;
  z-index: 2147483646;
  border: 2px solid #e74c3c;
  background: rgba(231, 76, 60, 0.1);
}

.__cb-hint {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  background: #1a1a2e;
  color: #e0e0e0;
  padding: 8px 16px;
  border-radius: 20px;
  font: 13px/1.4 -apple-system, sans-serif;
  pointer-events: auto;
  box-shadow: 0 2px 12px rgba(0,0,0,0.4);
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.__cb-hint.--dragging {
  cursor: grabbing;
}

.__cb-hint-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  color: #999;
  font-size: 12px;
  line-height: 1;
  border: none;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.__cb-hint-close:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.__cb-toast {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
  background: #2ecc71;
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
  font: 13px/1.4 -apple-system, sans-serif;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  pointer-events: none;
  animation: __cb-fadeInOut 1.5s ease-in-out;
}

@keyframes __cb-fadeInOut {
  0% { opacity: 0; transform: translateY(-8px); }
  15% { opacity: 1; transform: translateY(0); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-8px); }
}

.__cb-screen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2147483647;
  cursor: crosshair;
  background: rgba(0, 0, 0, 0.2);
}

.__cb-screen-selection {
  position: fixed;
  z-index: 2147483647;
  border: 2px solid #4A90D9;
  background: rgba(74, 144, 217, 0.15);
  pointer-events: none;
}

.__cb-screen-size {
  position: fixed;
  z-index: 2147483647;
  background: #1a1a2e;
  color: #e0e0e0;
  padding: 4px 8px;
  border-radius: 4px;
  font: 11px/1.4 'SF Mono', Monaco, Consolas, monospace;
  pointer-events: none;
}
`;
