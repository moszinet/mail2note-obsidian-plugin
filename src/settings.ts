import { App, PluginSettingTab, Setting } from 'obsidian';
import type Mail2NotePlugin from './main';

export type AttachmentFolderStrategy = 'same' | 'per-note' | 'shared';

export interface Mail2NoteSettings {
	apiBaseUrl: string;
	apiKey: string;
	targetFolder: string;
	pollIntervalMinutes: number;
	attachmentFolderStrategy: AttachmentFolderStrategy;
	filenameTemplate: string;
	deliveredMessageIds: string[];
}

export const DEFAULT_SETTINGS: Mail2NoteSettings = {
	apiBaseUrl: 'https://mail2note.com',
	apiKey: '',
	targetFolder: 'mail2note',
	pollIntervalMinutes: 1,
	attachmentFolderStrategy: 'same',
	filenameTemplate: '{date}-{subject}',
	deliveredMessageIds: [],
};

const API_KEY_PATTERN = /^m2n_[0-9a-f]{64}$/;

export class Mail2NoteSettingTab extends PluginSettingTab {
	plugin: Mail2NotePlugin;

	constructor(app: App, plugin: Mail2NotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Connection').setHeading();

		// API base URL
		{
			const setting = new Setting(containerEl)
				.setName('API base URL')
				.setDesc('Change only if you are self-hosting mail2note. Default: https://mail2note.com')
				.addText(text => {
					text.setPlaceholder('https://mail2note.com')
						.setValue(this.plugin.settings.apiBaseUrl)
						.onChange(async (value) => {
							const trimmed = value.trim();
							this.plugin.settings.apiBaseUrl = trimmed;
							await this.plugin.saveSettings();
							this.plugin.onSettingsChanged();
							setValidation(errorEl, validateUrl(trimmed));
						});
				});
			const errorEl = setting.settingEl.createEl('p', { cls: 'mail2note-validation' });
			setValidation(errorEl, validateUrl(this.plugin.settings.apiBaseUrl));
		}

		// API key
		{
			const setting = new Setting(containerEl)
				.setName('API key')
				.setDesc('Your m2n_ key from the mail2note dashboard.')
				.addText(text => {
					text.setPlaceholder('m2n_...')
						.setValue(this.plugin.settings.apiKey)
						.onChange(async (value) => {
							const trimmed = value.trim();
							this.plugin.settings.apiKey = trimmed;
							await this.plugin.saveSettings();
							this.plugin.onSettingsChanged();
							setValidation(errorEl, validateApiKey(trimmed));
						});
					text.inputEl.setAttribute('type', 'password');
					text.inputEl.setAttribute('autocomplete', 'off');
				});
			const errorEl = setting.settingEl.createEl('p', { cls: 'mail2note-validation' });
			setValidation(errorEl, validateApiKey(this.plugin.settings.apiKey));
		}

		new Setting(containerEl).setName('Import').setHeading();

		// Target folder
		new Setting(containerEl)
			.setName('Target folder')
			.setDesc('Vault folder where imported notes are saved.')
			.addText(text => {
				text.setPlaceholder('mail2note')
					.setValue(this.plugin.settings.targetFolder)
					.onChange(async (value) => {
						this.plugin.settings.targetFolder = value.trim() || 'mail2note';
						await this.plugin.saveSettings();
					});
			});

		// Filename template
		new Setting(containerEl)
			.setName('Filename template')
			.setDesc('Variables: {date}, {subject}, {message_id}')
			.addText(text => {
				text.setPlaceholder('{date}-{subject}')
					.setValue(this.plugin.settings.filenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.filenameTemplate = value.trim() || '{date}-{subject}';
						await this.plugin.saveSettings();
					});
			});

		// Attachment folder strategy
		new Setting(containerEl)
			.setName('Attachment folder')
			.setDesc('Where to save attachments relative to the target folder.')
			.addDropdown(drop => {
				drop.addOption('same', 'Same folder as note')
					.addOption('per-note', 'Per-note subfolder')
					.addOption('shared', 'Shared attachments folder')
					.setValue(this.plugin.settings.attachmentFolderStrategy)
					.onChange(async (value) => {
						this.plugin.settings.attachmentFolderStrategy = value as AttachmentFolderStrategy;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setName('Polling').setHeading();

		// Poll interval
		new Setting(containerEl)
			.setName('Poll interval')
			.setDesc('How often to check for new notes. Set to "manual only" to disable automatic polling.')
			.addDropdown(drop => {
				drop.addOption('1', 'Every minute')
					.addOption('5', 'Every 5 minutes')
					.addOption('15', 'Every 15 minutes')
					.addOption('30', 'Every 30 minutes')
					.addOption('60', 'Every hour')
					.addOption('0', 'Manual only')
					.setValue(String(this.plugin.settings.pollIntervalMinutes))
					.onChange(async (value) => {
						this.plugin.settings.pollIntervalMinutes = parseInt(value, 10);
						await this.plugin.saveSettings();
						this.plugin.onSettingsChanged();
					});
			});
	}
}

function validateUrl(url: string): string {
	if (!url) return 'API base URL is required.';
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			return 'URL must use http or https.';
		}
		return '';
	} catch {
		return 'Invalid URL format.';
	}
}

function validateApiKey(key: string): string {
	if (!key) return '';
	if (!API_KEY_PATTERN.test(key)) {
		return 'Expected format: m2n_ followed by 64 lowercase hex characters.';
	}
	return '';
}

function setValidation(el: HTMLElement, message: string): void {
	el.setText(message);
	el.toggleClass('mail2note-validation--visible', message.length > 0);
}
