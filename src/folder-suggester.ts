import { AbstractInputSuggest, App, TFolder } from 'obsidian';

/**
 * Vault-folder autocomplete attached to a text input. Walks the vault
 * folder tree (folders only — files are skipped) and filters by
 * case-insensitive substring match against the folder path.
 *
 * Non-existent folder paths are still allowed: the suggester only
 * suggests, it does not validate. The text input's onChange handler
 * still fires when a suggestion is picked because we dispatch a
 * synthetic 'input' event via inputEl.trigger('input').
 */
export class FolderSuggester extends AbstractInputSuggest<TFolder> {
	private readonly inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	protected getSuggestions(query: string): TFolder[] {
		const lower = query.toLowerCase();
		const folders: TFolder[] = [];
		const walk = (folder: TFolder): void => {
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) walk(child);
			}
		};
		walk(this.app.vault.getRoot());
		return folders.filter((f) => f.path.toLowerCase().includes(lower));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path === '' || folder.path === '/' ? '/' : folder.path);
	}

	selectSuggestion(folder: TFolder, _evt: MouseEvent | KeyboardEvent): void {
		this.inputEl.value = folder.path;
		this.inputEl.trigger('input');
		this.close();
	}
}
