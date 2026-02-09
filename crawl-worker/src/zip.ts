import { zipSync, strToU8 } from 'fflate';
import type { CrawledFile } from './types';

export function createZip(files: CrawledFile[]): Uint8Array {
	const zipData: Record<string, Uint8Array> = {};

	for (const file of files) {
		// Normalize path — remove leading slash
		const path = file.path.replace(/^\//, '');
		if (!path) continue;

		zipData[path] = file.content;
	}

	return zipSync(zipData, { level: 6 });
}

export function textToBytes(text: string): Uint8Array {
	return strToU8(text);
}
