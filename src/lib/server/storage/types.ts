export interface PresignedUpload {
	url: string;
	method: 'PUT';
	headers: Record<string, string>;
}

// The only surface the app touches for file bytes. Local disk and R2 both implement it, so
// moving to hosted storage is configuration.
export interface Storage {
	presignUpload(
		key: string,
		// `size` is the exact byte length the browser declared; the signed URL accepts only that.
		opts: { contentType: string; size: number }
	): Promise<PresignedUpload>;
	put(key: string, data: Buffer, contentType: string): Promise<void>;
	get(key: string): Promise<Buffer>;
	move(from: string, to: string): Promise<void>;
	delete(key: string): Promise<void>;
}
