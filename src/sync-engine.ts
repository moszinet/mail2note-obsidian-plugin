import { App, Notice, Vault, normalizePath } from 'obsidian';
import { ApiClient, ApiError, ApiNote } from './api-client';
import type { Mail2NoteSettings } from './settings';

const DELIVERED_ID_LIMIT = 5000;
const MAX_BACKOFF_MULTIPLIER = 8;

export class SyncEngine {
	private isSyncing = false;
	private haltedDueToAuth = false;
	private backoffMultiplier = 1;
	private backoffUntil = 0;

	constructor(
		private readonly app: App,
		private readonly getSettings: () => Mail2NoteSettings,
		private readonly saveSettings: () => Promise<void>,
		private readonly updateStatus: (text: string) => void,
	) {}

	async tick(isManual = false): Promise<void> {
		if (this.haltedDueToAuth && !isManual) return;
		if (this.isSyncing) return;
		if (!isManual && Date.now() < this.backoffUntil) return;
		await this.runCycle(isManual);
	}

	resumeAfterSettingsChange(): void {
		this.haltedDueToAuth = false;
		this.backoffMultiplier = 1;
		this.backoffUntil = 0;
	}

	private makeApiClient(): ApiClient {
		const s = this.getSettings();
		return new ApiClient(s.apiBaseUrl, s.apiKey);
	}

	private async runCycle(isManual: boolean): Promise<void> {
		this.isSyncing = true;
		this.updateStatus('mail2note: syncing…');
		try {
			const client = this.makeApiClient();
			const result = await client.getNotes();
			if (!result.ok) {
				this.handleError(result, isManual);
				return;
			}
			const notes = result.data;
			let synced = 0;
			for (const note of notes) {
				const ok = await this.syncNote(note, client);
				if (ok) synced++;
			}
			this.backoffMultiplier = 1;
			this.backoffUntil = 0;
			const ts = new Date().toLocaleTimeString();
			const label = notes.length === 0
				? `mail2note: up to date (${ts})`
				: `mail2note: synced ${synced} note${synced !== 1 ? 's' : ''} (${ts})`;
			this.updateStatus(label);
			if (isManual) new Notice(label);
		} catch (err) {
			console.error('[mail2note] Unexpected sync error:', err);
			this.applyBackoff();
			this.updateStatus('mail2note: error');
			if (isManual) new Notice('mail2note: sync failed — see the developer console for details');
		} finally {
			this.isSyncing = false;
		}
	}

	private handleError(error: ApiError, isManual: boolean): void {
		if (error.kind === 'unauthorized') {
			this.haltedDueToAuth = true;
			new Notice('mail2note: invalid API key — update it in settings to resume sync');
			this.updateStatus('mail2note: auth error');
		} else if (error.kind === 'forbidden') {
			this.haltedDueToAuth = true;
			new Notice('mail2note: email not verified — verify your email at mail2note.com to resume sync');
			this.updateStatus('mail2note: auth error');
		} else if (error.kind === 'rate-limited') {
			this.backoffUntil = Date.now() + error.retryAfter * 1000;
			this.updateStatus('mail2note: rate limited');
		} else {
			this.applyBackoff();
			this.updateStatus('mail2note: error');
			if (isManual) new Notice('mail2note: sync failed — server error');
		}
	}

	private applyBackoff(): void {
		const settings = this.getSettings();
		const baseMs = Math.max(1, settings.pollIntervalMinutes) * 60 * 1000;
		this.backoffUntil = Date.now() + baseMs * this.backoffMultiplier;
		this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, MAX_BACKOFF_MULTIPLIER);
	}

	private async syncNote(note: ApiNote, client: ApiClient): Promise<boolean> {
		const settings = this.getSettings();
		const fm = parseFrontmatter(note.content);
		const messageId = fm['message_id'] ?? fm['message-id'] ?? '';

		if (messageId && settings.deliveredMessageIds.includes(messageId)) {
			await client.confirmDelivery(note.id);
			return true;
		}

		const folder = normalizePath(settings.targetFolder);
		await ensureFolder(this.app.vault, folder);

		const rawName = applyTemplate(settings.filenameTemplate, fm);
		const safeName = sanitizeFilename(rawName);
		const notePath = await resolveUniquePath(this.app.vault, folder, safeName, 'md');
		const noteBasename = notePath.slice(folder.length + 1).replace(/\.md$/, '');

		try {
			await this.app.vault.create(notePath, note.content);
		} catch (err) {
			console.error(`[mail2note] Failed to write note "${notePath}":`, err);
			return false;
		}

		for (const att of note.attachments) {
			const attResult = await client.getAttachment(note.id, att.filename);
			if (!attResult.ok) {
				console.error(`[mail2note] Failed to download attachment "${att.filename}" for note ${note.id}: ${attResult.kind}`);
				return false;
			}
			const attFolder = resolveAttachmentFolder(folder, noteBasename, settings.attachmentFolderStrategy);
			await ensureFolder(this.app.vault, attFolder);
			const dotIdx = att.filename.lastIndexOf('.');
			const attBase = dotIdx > 0 ? att.filename.slice(0, dotIdx) : att.filename;
			const attExt = dotIdx > 0 ? att.filename.slice(dotIdx + 1) : '';
			const attPath = await resolveUniquePath(this.app.vault, attFolder, sanitizeFilename(attBase), attExt);
			try {
				await this.app.vault.createBinary(attPath, attResult.data);
			} catch (err) {
				console.error(`[mail2note] Failed to write attachment "${attPath}":`, err);
				return false;
			}
		}

		const deleteResult = await client.confirmDelivery(note.id);
		if (!deleteResult.ok) {
			console.error(`[mail2note] Failed to confirm delivery for note ${note.id}: ${deleteResult.kind}`);
		}

		if (messageId) {
			settings.deliveredMessageIds.push(messageId);
			if (settings.deliveredMessageIds.length > DELIVERED_ID_LIMIT) {
				settings.deliveredMessageIds = settings.deliveredMessageIds.slice(-DELIVERED_ID_LIMIT);
			}
			await this.saveSettings();
		}

		return true;
	}
}

function parseFrontmatter(content: string): Record<string, string> {
	const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
	if (!match?.[1]) return {};
	const fm: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const colon = line.indexOf(':');
		if (colon < 1) continue;
		const key = line.slice(0, colon).trim().toLowerCase();
		const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
		fm[key] = val;
	}
	return fm;
}

function applyTemplate(template: string, fm: Record<string, string>): string {
	const date = fm['date'] ?? new Date().toISOString().slice(0, 10);
	const subject = fm['subject'] ?? 'no-subject';
	const msgId = fm['message_id'] ?? '';
	return template
		.replace(/\{date\}/gi, date)
		.replace(/\{subject\}/gi, subject)
		.replace(/\{message_id\}/gi, msgId);
}

function sanitizeFilename(name: string): string {
	return (
		name
			.replace(/[/\\:*?"<>|]/g, '-')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 200) || 'untitled'
	);
}

async function ensureFolder(vault: Vault, path: string): Promise<void> {
	if (!vault.getAbstractFileByPath(path)) {
		await vault.createFolder(path);
	}
}

async function resolveUniquePath(vault: Vault, folder: string, base: string, ext: string): Promise<string> {
	const suffix = ext ? `.${ext}` : '';
	let path = normalizePath(`${folder}/${base}${suffix}`);
	let counter = 1;
	while (vault.getAbstractFileByPath(path)) {
		path = normalizePath(`${folder}/${base} ${counter}${suffix}`);
		counter++;
	}
	return path;
}

function resolveAttachmentFolder(noteFolder: string, noteBasename: string, strategy: string): string {
	if (strategy === 'per-note') return normalizePath(`${noteFolder}/${noteBasename}`);
	if (strategy === 'shared') return normalizePath(`${noteFolder}/attachments`);
	return noteFolder;
}
