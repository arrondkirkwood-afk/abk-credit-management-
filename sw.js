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

function replaceBlock(value, startNeedle, endNeedle, replacement) {
  const start = value.indexOf(startNeedle);
  if (start < 0) return value;
  const end = value.indexOf(endNeedle, start);
  if (end < 0) return value;
  return value.slice(0, start) + replacement + value.slice(end);
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
  const enhancedAnalyzerBlock = String.raw`      function analyzeReportText(text) {
        var source = String(text || "");
        var fullSsnDetected = containsFullSsn(source);
        var chunks = splitReportIntoChunks(source);
        var seen = {};
        var items = [];
        chunks.forEach(function (chunk) {
          var item = parseReportChunk(chunk);
          if (!isUsefulAnalysisItem(item)) return;
          var signature = analysisItemSignature(item);
          if (seen[signature]) return;
          seen[signature] = true;
          items.push(item);
        });
        applyDuplicateFlags(items);
        return {
          fullSsnDetected: fullSsnDetected,
          items: items.slice(0, 100)
        };
      }

      function splitReportIntoChunks(text) {
        var normalized = normalizeReportText(text);
        var lines = normalized.split("\\n").map(function (line) { return line.trim(); }).filter(Boolean);
        var chunks = [];
        var paragraphs = normalized.split(/\\n\\s*\\n+/).map(function (chunk) { return chunk.trim(); }).filter(Boolean);
        paragraphs.forEach(function (paragraph) {
          if (paragraph.length > 70 && looksLikeAccountChunk(paragraph)) chunks.push(paragraph);
        });

        var starts = [];
        lines.forEach(function (line, index) {
          if (isLikelyAccountStartAt(lines, index)) starts.push(index);
        });
        starts.forEach(function (start, index) {
          var nextStart = starts[index + 1] || Math.min(lines.length, start + 42);
          var end = Math.min(nextStart, start + 42);
          var chunk = lines.slice(start, end).join("\\n");
          if (looksLikeAccountChunk(chunk)) chunks.push(chunk);
        });

        if (!starts.length) lines.forEach(function (line, index) {
          if (looksLikeIssueLine(line) || looksLikeBureauTableLine(line)) {
            var windowChunk = lineWindow(lines, index, 8, 24);
            if (looksLikeAccountChunk(windowChunk)) chunks.push(windowChunk);
          }
        });

        if (!chunks.length && looksLikeAccountChunk(normalized)) {
          chunks.push(normalized.slice(0, 6000));
        }

        return uniqueChunks(chunks).filter(looksLikeAccountChunk);
      }

      function normalizeReportText(text) {
        return stripSensitiveText(String(text || ""))
          .replace(/\\r/g, "\\n")
          .replace(/\\t/g, " ")
          .replace(/[ ]{2,}/g, " ")
          .replace(/\\n{3,}/g, "\\n\\n");
      }

      function looksLikeAccountChunk(chunk) {
        return /account|tradeline|creditor|furnisher|collector|collection|balance|past due|status|opened|delinquent|charge[- ]?off|chargeoff|late payment|settled|paid in full|transferred|sold|original creditor|payment history/i.test(chunk || "");
      }

      function isLikelyAccountStart(line) {
        if (/^account\\s*(?:#|number|no|num)\\b/i.test(line || "")) return false;
        return /^(account name|tradeline|item|creditor|furnisher|collection agency|collector|company|subscriber|lender)\\s*[:#-]/i.test(line || "");
      }

      function isLikelyAccountStartAt(lines, index) {
        var line = lines[index] || "";
        if (isLikelyAccountStart(line)) return true;
        if (!isLikelyCreditorName(line)) return false;
        var nearby = lines.slice(index, Math.min(lines.length, index + 14)).join(" ");
        return looksLikeAccountChunk(nearby) && /(balance|status|account|opened|payment|past due|collection|charge[- ]?off|late|credit limit|high balance|original creditor)/i.test(nearby);
      }

      function looksLikeIssueLine(line) {
        return /collection|collector|debt buyer|charge[- ]?off|chargeoff|charged off|late payment|30 days late|60 days late|90 days late|120 days late|past due|paid in full|paid as agreed|settled|settlement|transferred|sold|original creditor|delinquent|consumer disputes|account information disputed|included in bankruptcy|repossession/i.test(line || "");
      }

      function looksLikeBureauTableLine(line) {
        return /(Experian|Equifax|TransUnion).*(Experian|Equifax|TransUnion)|\\b(balance|status|past due)\\b.*\\$\\s*\\d/i.test(line || "");
      }

      function lineWindow(lines, index, before, after) {
        return lines.slice(Math.max(0, index - before), Math.min(lines.length, index + after)).join("\\n");
      }

      function uniqueChunks(chunks) {
        var seen = {};
        var result = [];
        chunks.forEach(function (chunk) {
          var cleaned = String(chunk || "").trim();
          if (!cleaned) return;
          var key = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 220);
          if (seen[key]) return;
          seen[key] = true;
          result.push(cleaned);
        });
        return result;
      }

      function parseReportChunk(chunk) {
        var clean = stripSensitiveText(chunk);
        var bureau = firstMatch(clean, /\\b(Experian|Equifax|TransUnion)\\b/i);
        bureau = bureau ? titleBureau(bureau) : detectBureauFromContext(clean);
        var collectionAgency = extractField(clean, ["Collection Agency", "Collector", "Collection Company", "Collection Agency Name", "Assigned To"]);
        var creditorName = extractField(clean, ["Account Name", "Creditor", "Creditor Name", "Furnisher", "Furnisher Name", "Company", "Company Name", "Subscriber", "Subscriber Name", "Lender", "Name"]);
        var accountName = cleanAccountName(collectionAgency || creditorName || findBestAccountName(clean));
        var item = {
          id: createId(),
          selected: false,
          source: "credit-report-analysis",
          accountName: accountName,
          accountNumber: partializeAccountNumber(extractField(clean, ["Account Number", "Account #", "Acct #", "Acct No", "Acct Number", "Reference Number", "Reference #", "Partial Account Number"]) || extractPartialAccountNumber(clean)),
          originalCreditor: extractField(clean, ["Original Creditor", "Original Creditor Name", "Original Lender", "Original Account Name"]),
          collectionAgency: collectionAgency,
          currentCreditor: extractField(clean, ["Current Creditor", "Current Owner", "Debt Buyer", "Current Owner Name", "Current Creditor Name"]),
          claimedBalance: extractMoneyField(clean, ["Balance", "Current Balance", "Amount Owed", "Amount Claimed", "Recent Balance", "Reported Balance"]),
          pastDueAmount: extractMoneyField(clean, ["Past Due", "Past Due Amount"]),
          statusReported: extractField(clean, ["Account Status", "Status", "Account Condition", "Pay Status", "Payment Status", "Remarks", "Comments"]) || extractStatusFromText(clean),
          paymentStatus: extractField(clean, ["Payment Status", "Pay Status"]),
          dateOpened: extractDateField(clean, ["Date Opened", "Opened", "Opened Date"]),
          dateClosed: extractDateField(clean, ["Date Closed", "Closed", "Closed Date"]),
          dateFirstDelinquent: extractDateField(clean, ["Date First Delinquent", "First Delinquency", "DOFD", "Date of First Delinquency", "First Major Delinquency"]),
          lastPaymentDate: extractDateField(clean, ["Last Payment", "Last Payment Date", "Date of Last Payment"]),
          bureau: bureau || "Not sure",
          possibleIssue: "",
          confidence: "Low",
          mainReason: "other_error",
          itemKind: "Other credit report error",
          notes: ""
        };
        classifyAnalysisItem(item, clean);
        if (!item.accountName) item.accountName = fallbackAccountTitle(item, clean);
        return item;
      }

      function classifyAnalysisItem(item, text) {
        var issues = [];
        var lower = (text || "").toLowerCase();
        var hasBalance = numericMoney(item.claimedBalance) > 0;
        var hasPastDue = numericMoney(item.pastDueAmount) > 0;
        if (/collection|collector|debt buyer/.test(lower) || item.collectionAgency) {
          item.itemKind = "Collection account";
          addIssue(issues, "Collection account");
          if (!item.originalCreditor) {
            addIssue(issues, "Collection agency reporting without clear original creditor");
            item.mainReason = "not_validated";
          }
          if (!item.currentCreditor && !/authority|assignment|assigned|owner/i.test(text)) {
            addIssue(issues, "Collector authority to collect is not clear from the report text");
            if (item.mainReason === "other_error") item.mainReason = "no_authority";
          }
        }
        if (/charge[- ]?off|chargeoff|charged off|profit and loss|bad debt/.test(lower)) {
          item.itemKind = "Charge-off account";
          addIssue(issues, "Charge-off account");
          if (item.mainReason === "other_error") item.mainReason = "wrong_status";
        }
        if (/late payment|30 days late|60 days late|90 days late|120 days late|150 days late|180 days late|late\\s*[:\\-]|delinquent|past due/.test(lower)) {
          if (item.itemKind === "Other credit report error") item.itemKind = "Late payment";
          addIssue(issues, hasPastDue ? "Past due or late-payment reporting needs review" : "Late payment");
          if (item.mainReason === "other_error") item.mainReason = "wrong_status";
        }
        if (/paid|settled|settlement|paid in full|paid as agreed/.test(lower) && hasBalance) {
          item.itemKind = "Paid or settled account reporting wrong";
          addIssue(issues, "Paid or settled language with balance still shown");
          item.mainReason = "paid_wrong";
        }
        if (/transferred|sold to|purchased by|sold\\/transferred/.test(lower) && hasBalance) {
          addIssue(issues, "Transferred or sold account still appears to show a balance");
          if (item.mainReason === "other_error") item.mainReason = "wrong_balance";
        }
        if (/original creditor\\s*[:\\-]\\s*(unknown|not listed|n\\/a|none|--)?\\s*$/im.test(text) || (!item.originalCreditor && item.itemKind === "Collection account")) {
          addIssue(issues, "Original creditor missing or unclear");
          if (item.mainReason === "other_error") item.mainReason = "wrong_original_creditor";
        }
        if (bureauBalanceMismatch(text)) {
          addIssue(issues, "Different information across credit bureaus");
          item.mainReason = "bureau_mismatch";
        }
        if (/status.*(open|closed).*status.*(closed|open)|paid.*unpaid|settled.*balance|closed.*balance|balance.*closed/i.test(text)) {
          addIssue(issues, "Account status appears inconsistent");
          if (item.mainReason === "other_error") item.mainReason = "wrong_status";
        }
        if (isPossiblyObsolete(item.dateFirstDelinquent || item.dateClosed || item.lastPaymentDate) || possibleObsoleteFromText(text)) {
          addIssue(issues, "Possible obsolete reporting based on visible negative-account dates");
          item.mainReason = "too_old";
        }
        if ((hasBalance || hasPastDue) && /collection|charge[- ]?off|late|delinquent|past due|settled|transferred|sold/i.test(text)) {
          addIssue(issues, "Balance, past-due amount, or status should be checked against records");
          if (item.mainReason === "other_error") item.mainReason = "wrong_balance";
        }
        if (/account information disputed|consumer disputes|previously investigated|verified as accurate|reinvestigation/i.test(text)) {
          addIssue(issues, "Prior dispute or verification language may support a follow-up review");
          if (item.mainReason === "other_error") item.mainReason = "other_error";
        }
        if (!issues.length) {
          addIssue(issues, "Other credit report error");
          item.mainReason = item.mainReason || "other_error";
        }
        if (item.mainReason === "other_error") {
          if (/balance/i.test(text)) item.mainReason = "wrong_balance";
          else if (/date|opened|closed|delinquent/i.test(text)) item.mainReason = "wrong_dates";
        }
        item.possibleIssue = issues.join("; ");
        item.confidence = issues.length >= 2 && (item.accountName || item.accountNumber || item.claimedBalance || item.statusReported) ? "High" : (item.accountName && (item.claimedBalance || item.statusReported || /collection|charge[- ]?off|late|settled|paid/i.test(text)) ? "Medium" : "Low");
        item.notes = defaultAnalysisNote(item);
      }

      function addIssue(issues, issue) {
        if (issues.indexOf(issue) < 0) issues.push(issue);
      }

      function isUsefulAnalysisItem(item) {
        var hasIdentity = Boolean(item.accountName || item.accountNumber || item.collectionAgency || item.originalCreditor || item.currentCreditor);
        var hasData = Boolean(item.claimedBalance || item.pastDueAmount || item.statusReported || item.paymentStatus || item.dateOpened || item.dateClosed || item.dateFirstDelinquent || item.lastPaymentDate);
        var hasSpecificIssue = item.possibleIssue && item.possibleIssue !== "Other credit report error";
        return hasIdentity || (hasData && hasSpecificIssue);
      }

      function analysisItemSignature(item) {
        return [
          normalizeAccountKey(item.accountName || item.collectionAgency || item.originalCreditor || item.currentCreditor || ""),
          String(item.accountNumber || "").replace(/\\D/g, "").slice(-4),
          String(item.claimedBalance || "").replace(/[^0-9.]/g, ""),
          String(item.statusReported || "").toLowerCase().slice(0, 32)
        ].join("|");
      }

      function findBestAccountName(text) {
        var labeled = extractField(text, ["Account Name", "Creditor Name", "Furnisher Name", "Company Name", "Subscriber Name", "Lender"]);
        if (cleanAccountName(labeled)) return labeled;
        return firstLikelyName(text);
      }

      function fallbackAccountTitle(item, text) {
        if (item.collectionAgency) return item.collectionAgency;
        if (item.originalCreditor) return item.originalCreditor;
        if (item.currentCreditor) return item.currentCreditor;
        if (/collection|collector|debt buyer/i.test(text)) return "Possible collection account";
        if (/charge[- ]?off|chargeoff/i.test(text)) return "Possible charge-off account";
        if (/late payment|past due|delinquent/i.test(text)) return "Possible late payment item";
        if (/paid|settled/i.test(text)) return "Possible paid or settled reporting issue";
        return "";
      }

      function extractPartialAccountNumber(text) {
        var match = String(text || "").match(/\\b(?:account|acct|acct no|account number|reference)\\b[^\\n]{0,50}([xX*#-]{2,}\\s*\\d{2,6}|\\d[\\d -]{4,})/i);
        return match ? partializeAccountNumber(match[1]) : "";
      }

      function partializeAccountNumber(value) {
        var cleaned = cleanExtractedValue(value);
        var digits = cleaned.replace(/\\D/g, "");
        if (digits.length > 4) return "ending in " + digits.slice(-4);
        return cleaned.slice(0, 28);
      }

      function extractStatusFromText(text) {
        var match = String(text || "").match(/\\b(?:charged off|charge-off|chargeoff|collection|paid in full|paid as agreed|settled|closed|open|current|delinquent|past due|late payment|transferred|sold|repossession)\\b(?:[^\\n]{0,55})?/i);
        return match ? cleanExtractedValue(match[0]).slice(0, 90) : "";
      }

      function possibleObsoleteFromText(text) {
        var source = String(text || "");
        if (!/date first delinquent|first delinquency|dofd|charge[- ]?off|collection|closed|last payment|delinquent/i.test(source)) return false;
        var matches = source.match(/\\b(?:\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|\\d{4}[\\/-]\\d{1,2}[\\/-]\\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2},?\\s+\\d{4})\\b/gi) || [];
        return matches.some(isPossiblyObsolete);
      }

      function containsFullSsn(value) {
        var text = String(value || "");
        return /\\b\\d{3}[- ]\\d{2}[- ]\\d{4}\\b/.test(text) || /\\b(?:ssn|social security number)\\b[^\\n]{0,30}\\d{9}\\b/i.test(text);
      }

`;
  output = replaceBlock(output, '      function analyzeReportText(text) {', '      function applyDuplicateFlags(items) {', enhancedAnalyzerBlock);
  output = replaceAllText(output, '<div><h3>Review possible dispute items</h3><p class="small-note">These are possible issues, not conclusions. Select only the items you want to dispute and edit anything the scan got wrong.</p></div>', '<div><h3>Review possible dispute avenues</h3><p class="small-note">These are possible issues, not conclusions. Select only the items you want to dispute and edit anything the scan got wrong.</p></div>');
  output = replaceAllText(output, '\'<p class="muted">\' + escapeHtml(item.possibleIssue || "Possible issue detected") + \' | Confidence: \' + escapeHtml(item.confidence || "Low") + \'</p>\'', '\'<p class="muted"><strong>Possible avenues:</strong> \' + escapeHtml(item.possibleIssue || "Possible issue detected") + \' | Confidence: \' + escapeHtml(item.confidence || "Low") + \'</p>\'');
  output = replaceAllText(output, 'var verifiedResponse = /verified|previously verified|generic response|incomplete response|method of verification/i.test(notes);', 'var verifiedResponse = /previously verified|verified as accurate|generic response|incomplete response|method of verification/i.test(notes);');
  output = replaceAllText(output, 'var ssn = /\\\\b\\\\d{3}[- ]?\\\\d{2}[- ]?\\\\d{4}\\\\b/.test(combinedText);', 'var ssn = containsFullSsn(combinedText);');
  output = replaceBlock(output, '      function stripSensitiveText(value) {', '      function loadState() {', String.raw`      function stripSensitiveText(value) {
        return String(value || "")
          .replace(/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, "[full SSN removed]")
          .replace(/\b((?:ssn|social security number)\s*[:#-]?\s*)\d{9}\b/gi, "$1[full SSN removed]");
      }

`);
  output = replaceAllText(output, '"Subject: " + recommendation.type + " - " + accountReference(draft),', '"Subject: " + recommendation.type + " - " + subjectDetail(draft),');
  output = replaceAllText(output, '"Subject: Goodwill request - not a legal dispute - " + accountReference(draft),', '"Subject: Goodwill request - not a legal dispute - " + subjectDetail(draft),');
  output = replaceAllText(output, '"Account Reference: " + accountReference(draft),', '"Account Number / Reference: " + accountReference(draft),');
  output = replaceAllText(output, '"Account Reference",', '"Account Details",');
  output = replaceAllText(output, 'return "Legal Basis: This request concerns debt validation rights', 'return "This request concerns debt validation rights');
  output = replaceAllText(output, 'return "Legal Basis: This is a direct dispute regarding information', 'return "This is a direct dispute regarding information');
  output = replaceAllText(output, 'return "Legal Basis: This dispute concerns the accuracy', 'return "This dispute concerns the accuracy');
  output = replaceAllText(output, 'if (draft.advanced.extraNotes) rows.push("- Additional notes: " + draft.advanced.extraNotes);', 'if (draft.advanced.extraNotes && !isAutoAnalysisNote(draft.advanced.extraNotes)) rows.push("- Additional notes: " + draft.advanced.extraNotes);');
  output = replaceAllText(output, 'function documentsBlock(draft) {', 'function isAutoAnalysisNote(value) {\\n        return /^Created from credit report analysis\\\\b/i.test(String(value || "").trim());\\n      }\\n\\n      function documentsBlock(draft) {');
  output = replaceAllText(output, 'return draft.accountNumber || "account reference not provided";', 'return draft.accountNumber || "Not provided";');
  output = replaceAllText(output, 'function hasFactualReason(draft) {', 'function subjectDetail(draft) {\\n        return draft.accountName || draft.itemKind || accountReference(draft);\\n      }\\n\\n      function hasFactualReason(draft) {');
  output = replaceAllText(output, 'var accountName = collectionAgency || creditorName || firstLikelyName(clean);', 'var accountName = cleanAccountName(collectionAgency || creditorName || firstLikelyName(clean));');
  output = replaceAllText(output, 'draft.accountName = stripSensitiveText(item.accountName || item.collectionAgency || item.originalCreditor || "");', 'draft.accountName = cleanAccountName(stripSensitiveText(item.accountName || item.collectionAgency || item.originalCreditor || ""));');
  output = replaceAllText(output, 'draft.advanced.extraNotes = "Created from credit report analysis. Extracted issue: " + stripSensitiveText(item.possibleIssue || "Possible factual issue.");', 'draft.advanced.extraNotes = "";');
  output = replaceAllText(output, 'if (!/^(account|balance|status|date|opened|closed|past due|payment|bureau|credit report|transunion|experian|equifax)\\b/i.test(lines[i])) {\\n            return stripSensitiveText(lines[i]).slice(0, 80);\\n          }', 'if (isLikelyCreditorName(lines[i])) {\\n            return stripSensitiveText(lines[i]).slice(0, 80);\\n          }');
  output = replaceAllText(output, 'function detectBureauFromContext(text) {', 'function isLikelyCreditorName(value) {\\n        var text = String(value || "").trim();\\n        if (!text) return false;\\n        if (/^(account|balance|current balance|high balance|credit limit|status|date|opened|closed|past due|past due amount|payment|payment history|bureau|credit report|transunion|experian|equifax|prepared for|confirmation|report number|report date|personal information|consumer|contact|address|phone|email|original creditor|current creditor|remarks|comments|terms|responsibility|monthly payment|last reported|date reported|inquiries|public records|collections|potentially negative)\\\\b/i.test(text)) return false;\\n        if (/^(arron|arrond|kirkwood|annual credit report)\\\\b/i.test(text)) return false;\\n        if (/^(date|confirmation|original creditor|current creditor|balance|status|account number)\\\\s*[:#-]/i.test(text)) return false;\\n        if (/^[a-z ]+:\\\\s*$/i.test(text)) return false;\\n        if (/@/.test(text)) return false;\\n        if (/\\\\b\\\\d{5}(?:-\\\\d{4})?\\\\b/.test(text) && /\\\\b(?:street|st|lane|ln|road|rd|drive|dr|houston|texas|tx)\\\\b/i.test(text)) return false;\\n        if (text.length > 80) return false;\\n        return /[a-z]/i.test(text) && !/^\\\\$?\\\\d[\\\\d,]*(?:\\\\.\\\\d{2})?$/.test(text);\\n      }\\n\\n      function cleanAccountName(value) {\\n        var text = cleanExtractedValue(value);\\n        if (!isLikelyCreditorName(text)) return "";\\n        return text.slice(0, 80);\\n      }\\n\\n      function detectBureauFromContext(text) {');
  return output;
}
