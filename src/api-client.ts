import { RequestUrlResponse, requestUrl } from 'obsidian';

export interface ApiNoteAttachment {
	filename: string;
	url: string;
}

export interface ApiNote {
	id: number;
	content: string;
	attachments: ApiNoteAttachment[];
}

export type ApiResult<T> =
	| { ok: true; data: T }
	| { ok: false; kind: 'unauthorized' }
	| { ok: false; kind: 'forbidden' }
	| { ok: false; kind: 'rate-limited'; retryAfter: number }
	| { ok: false; kind: 'server-error'; status: number }
	| { ok: false; kind: 'network-error'; message: string };

export type ApiError = Extract<ApiResult<never>, { ok: false }>;

export class ApiClient {
	constructor(
		private readonly baseUrl: string,
		private readonly apiKey: string,
	) {}

	private get headers(): Record<string, string> {
		return { Authorization: `Bearer ${this.apiKey}` };
	}

	async getNotes(): Promise<ApiResult<ApiNote[]>> {
		try {
			const res = await requestUrl({
				url: `${this.baseUrl}/api/v1/notes`,
				method: 'GET',
				headers: this.headers,
				throw: false,
			});
			if (res.status === 200) {
				return { ok: true, data: (res.json as { notes: ApiNote[] }).notes };
			}
			return this.classifyError(res);
		} catch (err) {
			return { ok: false, kind: 'network-error', message: String(err) };
		}
	}

	async getAttachment(noteId: number, filename: string): Promise<ApiResult<ArrayBuffer>> {
		try {
			const res = await requestUrl({
				url: `${this.baseUrl}/api/v1/notes/${noteId}/attachments/${encodeURIComponent(filename)}`,
				method: 'GET',
				headers: this.headers,
				throw: false,
			});
			if (res.status === 200) {
				return { ok: true, data: res.arrayBuffer };
			}
			return this.classifyError(res);
		} catch (err) {
			return { ok: false, kind: 'network-error', message: String(err) };
		}
	}

	async confirmDelivery(noteId: number): Promise<ApiResult<void>> {
		try {
			const res = await requestUrl({
				url: `${this.baseUrl}/api/v1/notes/${noteId}`,
				method: 'DELETE',
				headers: this.headers,
				throw: false,
			});
			if (res.status === 200) {
				return { ok: true, data: undefined };
			}
			return this.classifyError(res);
		} catch (err) {
			return { ok: false, kind: 'network-error', message: String(err) };
		}
	}

	private classifyError(res: RequestUrlResponse): ApiError {
		if (res.status === 401) return { ok: false, kind: 'unauthorized' };
		if (res.status === 403) return { ok: false, kind: 'forbidden' };
		if (res.status === 429) {
			const raw = res.headers['retry-after'];
			const secs = raw !== undefined ? parseInt(raw, 10) : 60;
			return { ok: false, kind: 'rate-limited', retryAfter: isNaN(secs) ? 60 : secs };
		}
		return { ok: false, kind: 'server-error', status: res.status };
	}
}
