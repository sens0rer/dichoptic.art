import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import type { Storage } from './types';

let client: S3Client | undefined;

// Cloudflare R2 speaks the S3 API; the account id picks the endpoint.
const s3 = () =>
	(client ??= new S3Client({
		region: 'auto',
		endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: config.r2.accessKeyId,
			secretAccessKey: config.r2.secretAccessKey
		}
	}));

const Bucket = () => config.r2.bucket;

export const r2Storage: Storage = {
	async presignUpload(key, { contentType, size }) {
		const command = new PutObjectCommand({
			Bucket: Bucket(),
			Key: key,
			ContentType: contentType,
			ContentLength: size
		});
		const url = await getSignedUrl(s3(), command, {
			expiresIn: 3600,
			signableHeaders: new Set(['content-type', 'content-length'])
		});
		return { url, method: 'PUT', headers: { 'content-type': contentType } };
	},
	async put(key, data, contentType) {
		await s3().send(new PutObjectCommand({ Bucket: Bucket(), Key: key, Body: data, ContentType: contentType }));
	},
	async get(key) {
		const res = await s3().send(new GetObjectCommand({ Bucket: Bucket(), Key: key }));
		return Buffer.from(await res.Body!.transformToByteArray());
	},
	async move(from, to) {
		await s3().send(
			new CopyObjectCommand({ Bucket: Bucket(), Key: to, CopySource: `${Bucket()}/${from}`, MetadataDirective: 'COPY' })
		);
		await s3().send(new DeleteObjectCommand({ Bucket: Bucket(), Key: from }));
	},
	async delete(key) {
		await s3().send(new DeleteObjectCommand({ Bucket: Bucket(), Key: key }));
	}
};
