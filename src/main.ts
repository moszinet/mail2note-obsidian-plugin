import { App, Platform, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, Mail2NoteSettings, Mail2NoteSettingTab } from './settings';
import { SyncEngine } from './sync-engine';

interface AppWithSetting extends App {
	setting?: { open?: () => void };
}

export default class Mail2NotePlugin extends Plugin {
	settings: Mail2NoteSettings = { ...DEFAULT_SETTINGS };
	private syncEngine!: SyncEngine;
	private statusBarItem: HTMLElement | null = null;
	private intervalId: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.syncEngine = new SyncEngine(
			this.app,
			() => this.settings,
			() => this.saveSettings(),
			(text) => this.updateStatusBar(text),
		);

		this.addSettingTab(new Mail2NoteSettingTab(this.app, this));

		this.addRibbonIcon('refresh-cw', 'Sync mail2note now', () => {
			void this.syncEngine.tick(true);
		});

		if (!Platform.isMobile) {
			this.statusBarItem = this.addStatusBarItem();
			this.statusBarItem.setText('mail2note: idle');
		}

		this.addCommand({
			id: 'sync-now',
			name: 'Sync now',
			callback: () => { void this.syncEngine.tick(true); },
		});

		this.addCommand({
			id: 'open-settings',
			name: 'Open settings',
			callback: () => {
				(this.app as AppWithSetting).setting?.open?.();
			},
		});

		this.schedulePolling();
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<Mail2NoteSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
		if (!Array.isArray(this.settings.deliveredMessageIds)) {
			this.settings.deliveredMessageIds = [];
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	onSettingsChanged(): void {
		this.schedulePolling();
		this.syncEngine.resumeAfterSettingsChange();
	}

	schedulePolling(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
		const ms = this.settings.pollIntervalMinutes * 60 * 1000;
		if (ms > 0) {
			this.intervalId = this.registerInterval(
				window.setInterval(() => { void this.syncEngine.tick(); }, ms),
			);
		}
	}

	private updateStatusBar(text: string): void {
		this.statusBarItem?.setText(text);
	}
}
