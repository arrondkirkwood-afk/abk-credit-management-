const CACHE_NAME = "abk-credit-management-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon.svg",
  "./libs/pdf.min.js",
  "./libs/pdf.worker.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (isIndexRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
        .then((response) => patchIndexResponse(response))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});

function isIndexRequest(request) {
  const url = new URL(request.url);
  return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
}

function patchIndexResponse(response) {
  if (!response) return fetch("./index.html").then((fallback) => patchIndexResponse(fallback));
  return response.text().then((html) => {
    const patched = patchIndexHtml(html);
    return new Response(patched, {
      status: response.status,
      statusText: response.statusText,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  });
}

function replaceAllText(value, search, replacement) {
  return value.split(search).join(replacement);
}

function patchIndexHtml(html) {
  let output = html;
  const formalLetterBoxCss = `    .letter-box {
      background: #ffffff;
      border: 1px solid #c9d1d9;
      border-radius: 3px;
      box-shadow: 0 10px 30px rgba(23, 32, 44, 0.08);
      color: #000000;
      display: block;
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 12pt;
      line-height: 1.5;
      margin: 0 auto;
      max-width: 8.5in;
      min-height: 10.5in;
      padding: clamp(24px, 6vw, 0.75in);
      white-space: pre-wrap;
    }`;
  output = replaceAllText(output, `    .letter-box {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      min-height: 560px;
      white-space: pre-wrap;
    }`, formalLetterBoxCss);
  output = replaceAllText(output, `      @page {
        margin: 1in;
      }`, `      @page {
        size: letter;
        margin: 1in;
      }`);
  output = replaceAllText(output, `        line-height: 1.35;
        margin: 0;`, `        line-height: 1.5;
        margin: 0;`);
  output = replaceAllText(output, '"Subject: " + recommendation.type + " - " + accountReference(draft),', '"Subject: " + recommendation.type + " - " + subjectDetail(draft),');
  output = replaceAllText(output, '"Subject: Goodwill request - not a legal dispute - " + accountReference(draft),', '"Subject: Goodwill request - not a legal dispute - " + subjectDetail(draft),');
  output = replaceAllText(output, '"Account Reference: " + accountReference(draft),', '"Account Number / Reference: " + accountReference(draft),');
  output = replaceAllText(output, '"Account Reference",', '"Account Details",');
  output = replaceAllText(output, 'return "Legal Basis: This request concerns debt validation rights', 'return "This request concerns debt validation rights');
  output = replaceAllText(output, 'return "Legal Basis: This is a direct dispute regarding information', 'return "This is a direct dispute regarding information');
  output = replaceAllText(output, 'return "Legal Basis: This dispute concerns the accuracy', 'return "This dispute concerns the accuracy');
  output = replaceAllText(output, 'if (draft.advanced.extraNotes) rows.push("- Additional notes: " + draft.advanced.extraNotes);', 'if (draft.advanced.extraNotes && !isAutoAnalysisNote(draft.advanced.extraNotes)) rows.push("- Additional notes: " + draft.advanced.extraNotes);');
  output = replaceAllText(output, 'function documentsBlock(draft) {', 'function isAutoAnalysisNote(value) {\n        return /^Created from credit report analysis\\b/i.test(String(value || "").trim());\n      }\n\n      function documentsBlock(draft) {');
  output = replaceAllText(output, 'return draft.accountNumber || "account reference not provided";', 'return draft.accountNumber || "Not provided";');
  output = replaceAllText(output, 'function hasFactualReason(draft) {', 'function subjectDetail(draft) {\n        return draft.accountName || draft.itemKind || accountReference(draft);\n      }\n\n      function hasFactualReason(draft) {');
  output = replaceAllText(output, 'var accountName = collectionAgency || creditorName || firstLikelyName(clean);', 'var accountName = cleanAccountName(collectionAgency || creditorName || firstLikelyName(clean));');
  output = replaceAllText(output, 'draft.accountName = stripSensitiveText(item.accountName || item.collectionAgency || item.originalCreditor || "");', 'draft.accountName = cleanAccountName(stripSensitiveText(item.accountName || item.collectionAgency || item.originalCreditor || ""));');
  output = replaceAllText(output, 'draft.advanced.extraNotes = "Created from credit report analysis. Extracted issue: " + stripSensitiveText(item.possibleIssue || "Possible factual issue.");', 'draft.advanced.extraNotes = "";');
  output = replaceAllText(output, 'if (!/^(account|balance|status|date|opened|closed|past due|payment|bureau|credit report|transunion|experian|equifax)\\b/i.test(lines[i])) {\n            return stripSensitiveText(lines[i]).slice(0, 80);\n          }', 'if (isLikelyCreditorName(lines[i])) {\n            return stripSensitiveText(lines[i]).slice(0, 80);\n          }');
  output = replaceAllText(output, 'function detectBureauFromContext(text) {', 'function isLikelyCreditorName(value) {\n        var text = String(value || "").trim();\n        if (!text) return false;\n        if (/^(account|balance|status|date|opened|closed|past due|payment|bureau|credit report|transunion|experian|equifax|prepared for|confirmation|report number|report date|personal information|consumer|contact|address|phone|email)\\b/i.test(text)) return false;\n        if (/^(arron|arrond|kirkwood|annual credit report)\\b/i.test(text)) return false;\n        if (/^(date|confirmation)\\s*[:#-]/i.test(text)) return false;\n        if (/@/.test(text)) return false;\n        if (/\\b\\d{5}(?:-\\d{4})?\\b/.test(text) && /\\b(?:street|st|lane|ln|road|rd|drive|dr|houston|texas|tx)\\b/i.test(text)) return false;\n        if (text.length > 80) return false;\n        return /[a-z]/i.test(text) && !/^\\$?\\d[\\d,]*(?:\\.\\d{2})?$/.test(text);\n      }\n\n      function cleanAccountName(value) {\n        var text = cleanExtractedValue(value);\n        if (!isLikelyCreditorName(text)) return "";\n        return text.slice(0, 80);\n      }\n\n      function detectBureauFromContext(text) {');
  return output;
}
