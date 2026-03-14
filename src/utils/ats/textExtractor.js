// Use dynamic import for pdfjs-dist ESM
const mammoth = require("mammoth");

async function extractText(file) {

if(file.mimetype === "application/pdf"){
	const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
	// Convert Buffer to Uint8Array
	const uint8array = new Uint8Array(file.buffer);
	const loadingTask = pdfjsLib.getDocument({ data: uint8array });
	const pdf = await loadingTask.promise;
	let text = "";
	for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
		const page = await pdf.getPage(pageNum);
		const content = await page.getTextContent();
		text += content.items.map(item => item.str).join(" ") + "\n";
	}
	return text;
}

if(file.mimetype ==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"){

const result = await mammoth.extractRawText({
buffer:file.buffer
});

return result.value;

}

throw new Error("Unsupported file type");

}

module.exports = extractText;