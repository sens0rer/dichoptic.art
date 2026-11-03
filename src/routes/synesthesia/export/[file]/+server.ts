import { error, json } from '@sveltejs/kit';
import { isAdmin } from '#lib/server/admin';
import { answersCsv, exportAll, reverseCsv } from '#lib/server/synesthesiaExport';

// Downloads for analysis; admin only (sign in at /admin).
export async function GET({ params, cookies }) {
	if (!isAdmin(cookies)) error(404, 'Not found');
	const date = new Date().toISOString().slice(0, 10);
	const download = (name: string) => ({ 'content-disposition': `attachment; filename="colour-tests-${name}-${date}"` });
	switch (params.file) {
		case 'all.json':
			return json(await exportAll(), { headers: download('all.json') });
		case 'answers.csv':
			return new Response(await answersCsv(), { headers: { 'content-type': 'text/csv; charset=utf-8', ...download('answers.csv') } });
		case 'reverse.csv':
			return new Response(await reverseCsv(), { headers: { 'content-type': 'text/csv; charset=utf-8', ...download('reverse.csv') } });
		default:
			error(404, 'Not found');
	}
}
