/**
 * Lightweight Client-Side PDF Text Extractor
 * Parses text streams and decompresses FlateDecode objects without heavyweight external dependencies.
 */
async function extractTextFromPDF(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder('utf-8');
  const rawString = textDecoder.decode(bytes);

  let extractedText = '';

  // Strategy 1: Find text between BT (Begin Text) and ET (End Text) blocks
  const btEtRegex = /BT[\s\S]*?ET/g;
  const btBlocks = rawString.match(btEtRegex) || [];

  for (const block of btBlocks) {
    const tjMatches = [...block.matchAll(/\(([^)]+)\)\s*Tj/g)].map(m => m[1]);
    const arrayTjMatches = [...block.matchAll(/\[(.*?)\]\s*TJ/g)];
    for (const arr of arrayTjMatches) {
      const parts = [...arr[1].matchAll(/\(([^)]+)\)/g)].map(m => m[1]);
      tjMatches.push(parts.join(''));
    }
    if (tjMatches.length > 0) {
      extractedText += tjMatches.join(' ') + '\n';
    }
  }

  // Strategy 2: If compressed with FlateDecode, decompress streams via DecompressionStream
  if (!extractedText.trim() && typeof DecompressionStream !== 'undefined') {
    const objRegex = /<<[\s\S]*?\/Filter\s*\/FlateDecode[\s\S]*?>>\s*stream\r?\n/g;
    let match;
    while ((match = objRegex.exec(rawString)) !== null) {
      const startIdx = match.index + match[0].length;
      const endMarker = rawString.indexOf('endstream', startIdx);
      if (endMarker > startIdx) {
        const streamSlice = bytes.slice(startIdx, endMarker);
        try {
          const ds = new DecompressionStream('deflate');
          const decompressed = await new Response(
            new Blob([streamSlice]).stream().pipeThrough(ds)
          ).arrayBuffer();
          const decoded = new TextDecoder().decode(decompressed);
          const blocks = decoded.match(btEtRegex) || [];
          for (const block of blocks) {
            const tj = [...block.matchAll(/\(([^)]+)\)\s*Tj/g)].map(m => m[1]);
            const arrTj = [...block.matchAll(/\[(.*?)\]\s*TJ/g)];
            for (const arr of arrTj) {
              const parts = [...arr[1].matchAll(/\(([^)]+)\)/g)].map(m => m[1]);
              tj.push(parts.join(''));
            }
            if (tj.length > 0) extractedText += tj.join(' ') + '\n';
          }
        } catch (e) {
          // Continue to next stream
        }
      }
    }
  }

  // Strategy 3: Fallback extraction of readable ASCII text segments
  if (!extractedText.trim()) {
    const stringLiterals = [...rawString.matchAll(/\(([A-Za-z0-9\s.,!?:;@#\-_/]{4,})\)/g)].map(m => m[1]);
    if (stringLiterals.length > 0) {
      extractedText = stringLiterals.join(' ');
    }
  }

  // Unescape standard PDF octal escapes and slash escapes
  extractedText = extractedText
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\r/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, ' ');

  return extractedText.trim();
}

if (typeof window !== 'undefined') {
  window.extractTextFromPDF = extractTextFromPDF;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractTextFromPDF };
}
