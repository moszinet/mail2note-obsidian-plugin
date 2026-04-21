import { describe, expect, it } from 'vitest';
import Mail2NotePlugin from './main';

describe('Mail2NotePlugin', () => {
	it('loads without throwing', async () => {
		const fakeApp = {
			vault: {
				getAbstractFileByPath: () => null,
				create: async () => null,
				createBinary: async () => null,
				createFolder: async () => null,
			},
		} as never;
		const fakeManifest = { id: 'mail2note', version: '0.1.0' } as never;
		const plugin = new Mail2NotePlugin(fakeApp, fakeManifest);
		await expect(plugin.onload()).resolves.toBeUndefined();
	});
});
