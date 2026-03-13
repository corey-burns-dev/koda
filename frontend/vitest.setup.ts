import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock ResizeObserver for Radix UI components
class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserverMock;

// Mock scrollIntoView which is not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock pointer events for Radix UI (Select, Dialog, etc.)
if (!window.HTMLElement.prototype.hasPointerCapture) {
	window.HTMLElement.prototype.hasPointerCapture = vi.fn();
}
if (!window.HTMLElement.prototype.setPointerCapture) {
	window.HTMLElement.prototype.setPointerCapture = vi.fn();
}
if (!window.HTMLElement.prototype.releasePointerCapture) {
	window.HTMLElement.prototype.releasePointerCapture = vi.fn();
}
