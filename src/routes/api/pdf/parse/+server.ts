import { apiError, parsePdfResultSchema, withApiHandler } from '$lib/server/validation';
import { parsePdfFile } from '$lib/server/pdf/parse';

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

function isPdfFile(file: File): boolean {
	if (file.type === 'application/pdf') return true;
	return file.name.toLowerCase().endsWith('.pdf');
}

function validatePdfFile(file: File | null): File {
	if (!file) {
		throw apiError({
			code: 'VALIDATION_ERROR',
			status: 400,
			message: 'A PDF file is required in form field "file"'
		});
	}

	if (!(file instanceof File)) {
		throw apiError({
			code: 'VALIDATION_ERROR',
			status: 400,
			message: 'Invalid file payload'
		});
	}

	if (!isPdfFile(file)) {
		throw apiError({
			code: 'VALIDATION_ERROR',
			status: 400,
			message: 'Only PDF files are supported'
		});
	}

	if (file.size <= 0) {
		throw apiError({
			code: 'VALIDATION_ERROR',
			status: 400,
			message: 'Uploaded file is empty'
		});
	}

	if (file.size > MAX_PDF_SIZE_BYTES) {
		throw apiError({
			code: 'VALIDATION_ERROR',
			status: 413,
			message: `PDF file is too large. Max size is ${MAX_PDF_SIZE_BYTES} bytes`
		});
	}

	return file;
}

export const POST = withApiHandler(async ({ request }) => {
	const formData = await request.formData();
	const entry = formData.get('file');
	const file = validatePdfFile(entry instanceof File ? entry : null);

	const parsed = await parsePdfFile(file);
	return parsePdfResultSchema.parse(parsed);
});
