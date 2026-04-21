import { vi } from 'vitest';

// Obsidian patches HTMLElement.prototype with extra methods at runtime.
// Replicate the minimum surface needed for tests.
if (typeof HTMLElement !== 'undefined') {
	type AugmentedHTMLElement = HTMLElement & {
		setText?(text: string): void;
		createEl?(tag: string, opts?: Record<string, unknown>): HTMLElement;
		toggleClass?(cls: string, value: boolean): void;
		empty?(): void;
	};
	const proto = HTMLElement.prototype as AugmentedHTMLElement;
	if (!proto.setText) proto.setText = function (text) { this.textContent = text; };
	if (!proto.createEl) proto.createEl = function (tag, opts) {
		const el = document.createElement(tag);
		if (opts?.['text']) el.textContent = String(opts['text']);
		if (opts?.['cls']) el.className = String(opts['cls']);
		this.appendChild(el);
		return el;
	};
	if (!proto.toggleClass) proto.toggleClass = function (cls, value) {
		this.classList.toggle(cls, value);
	};
	if (!proto.empty) proto.empty = function () { this.innerHTML = ''; };
}

export class Plugin {
	app: unknown;
	manifest: unknown;

	constructor(app: unknown, manifest: unknown) {
		this.app = app;
		this.manifest = manifest;
	}

	async loadData(): Promise<unknown> {
		return null;
	}

	async saveData(_data: unknown): Promise<void> {}

	addSettingTab(_tab: unknown): void {}

	addCommand(_cmd: unknown): void {}

	addRibbonIcon(_icon: string, _title: string, _cb: unknown): HTMLElement {
		return document.createElement('div');
	}

	addStatusBarItem(): HTMLElement {
		return document.createElement('div');
	}

	registerInterval(id: number): number {
		return id;
	}

	registerEvent(_ref: unknown): void {}

	registerDomEvent(_el: unknown, _type: string, _cb: unknown): void {}

	register(_cb: () => void): void {}
}

export class PluginSettingTab {
	app: unknown;
	containerEl: HTMLElement;

	constructor(app: unknown, _plugin: unknown) {
		this.app = app;
		this.containerEl = document.createElement('div');
	}

	display(): void {}
}

export class Setting {
	settingEl: HTMLElement;

	constructor(_containerEl: HTMLElement) {
		this.settingEl = document.createElement('div');
	}

	setName(_name: string): this { return this; }

	setDesc(_desc: string | DocumentFragment): this { return this; }

	setHeading(): this { return this; }

	setClass(_cls: string): this { return this; }

	addText(_cb: (text: TextComponent) => void): this { return this; }

	addToggle(_cb: unknown): this { return this; }

	addDropdown(_cb: unknown): this { return this; }

	addButton(_cb: unknown): this { return this; }

	addExtraButton(_cb: unknown): this { return this; }
}

interface TextComponent {
	setPlaceholder(s: string): this;
	setValue(s: string): this;
	onChange(cb: (val: string) => void | Promise<void>): this;
	inputEl: HTMLInputElement;
}

export class Notice {
	message: string;

	constructor(message: string) {
		this.message = message;
	}
}

export const requestUrl = vi.fn().mockResolvedValue({
	status: 200,
	headers: {},
	json: { notes: [] },
	text: '',
	arrayBuffer: new ArrayBuffer(0),
});

export function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

export class Vault {
	getAbstractFileByPath = vi.fn().mockReturnValue(null);
	create = vi.fn().mockResolvedValue(null);
	createBinary = vi.fn().mockResolvedValue(null);
	createFolder = vi.fn().mockResolvedValue(null);
	process = vi.fn().mockResolvedValue(null);
	cachedRead = vi.fn().mockResolvedValue('');
	read = vi.fn().mockResolvedValue('');
	adapter = {};
}

export class TFile {
	path = '';
	name = '';
	basename = '';
	extension = '';
}

export class TFolder {
	path = '';
	name = '';
	children: unknown[] = [];
}

export const Platform = {
	isDesktop: true,
	isMobile: false,
};
