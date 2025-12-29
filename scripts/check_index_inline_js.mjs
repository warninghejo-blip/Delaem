import fs from 'node:fs';
import vm from 'node:vm';

function getLineStarts(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') starts.push(i + 1);
    }
    return starts;
}

function indexToLineCol(lineStarts, idx) {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lineStarts[mid] <= idx && (mid === lineStarts.length - 1 || lineStarts[mid + 1] > idx)) {
            return { line: mid + 1, col: idx - lineStarts[mid] + 1 };
        }
        if (lineStarts[mid] > idx) hi = mid - 1;
        else lo = mid + 1;
    }
    return { line: 1, col: idx + 1 };
}

function scanUnclosed(js) {
    // mode: 0 code, 1 lineComment, 2 blockComment, 3 single, 4 double, 5 template
    // When inside a template literal, `${` enters an embedded JS expression.
    // We track nested braces for that expression and return to template mode when it closes.
    let mode = 0;
    let line = 1;
    let col = 0;

    const stack = [];
    let inTemplateExpr = 0;

    const push = ch => stack.push({ ch, line, col });
    const peek = () => stack[stack.length - 1];
    const pop = closeCh => {
        const t = stack.pop();
        if (!t) {
            return { ok: false, reason: `Extra closing ${closeCh}`, at: { line, col } };
        }
        const ok =
            (t.ch === '{' && closeCh === '}') || (t.ch === '(' && closeCh === ')') || (t.ch === '[' && closeCh === ']');
        if (!ok) {
            return { ok: false, reason: `Mismatched close ${closeCh} for ${t.ch}`, open: t, at: { line, col } };
        }
        return null;
    };

    for (let i = 0; i < js.length; i++) {
        const c = js[i];
        const n = js[i + 1];

        if (c === '\n') {
            line++;
            col = 0;
        } else {
            col++;
        }

        if (mode === 1) {
            if (c === '\n') mode = inTemplateExpr > 0 ? 0 : 0;
            continue;
        }

        if (mode === 2) {
            if (c === '*' && n === '/') {
                mode = 0;
                i++;
                col++;
            }
            continue;
        }

        if (mode === 3) {
            if (c === '\\') {
                i++;
                col++;
                continue;
            }
            if (c === "'") mode = 0;
            continue;
        }

        if (mode === 4) {
            if (c === '\\') {
                i++;
                col++;
                continue;
            }
            if (c === '"') mode = 0;
            continue;
        }

        if (mode === 5) {
            if (c === '\\') {
                i++;
                col++;
                continue;
            }

            if (c === '`') {
                mode = 0;
                continue;
            }

            if (c === '$' && n === '{') {
                // Enter template expression
                inTemplateExpr = 1;
                push('{');
                mode = 0;
                i++;
                col++;
                continue;
            }

            continue;
        }

        // code mode (also used while inside template expressions)
        if (c === '/' && n === '/') {
            mode = 1;
            i++;
            col++;
            continue;
        }
        if (c === '/' && n === '*') {
            mode = 2;
            i++;
            col++;
            continue;
        }
        if (c === "'") {
            mode = 3;
            continue;
        }
        if (c === '"') {
            mode = 4;
            continue;
        }
        if (c === '`') {
            mode = 5;
            continue;
        }

        if (c === '{') {
            push('{');
            if (inTemplateExpr > 0) inTemplateExpr++;
            continue;
        }
        if (c === '}') {
            const err = pop('}');
            if (err) return err;
            if (inTemplateExpr > 0) {
                inTemplateExpr--;
                if (inTemplateExpr === 0) {
                    mode = 5;
                }
            }
            continue;
        }
        if (c === '(' || c === '[') {
            push(c);
            continue;
        }
        if (c === ')' || c === ']') {
            const err = pop(c);
            if (err) return err;
            continue;
        }
    }

    if (mode !== 0) {
        const modeName =
            mode === 1
                ? 'lineComment'
                : mode === 2
                  ? 'blockComment'
                  : mode === 3
                    ? 'singleQuote'
                    : mode === 4
                      ? 'doubleQuote'
                      : 'template';
        return { ok: false, reason: `Unclosed ${modeName}`, at: { line, col } };
    }

    if (stack.length) {
        return { ok: false, reason: 'Unclosed bracket', open: peek(), openStack: stack.slice(-5) };
    }

    if (inTemplateExpr > 0) {
        return { ok: false, reason: 'Unclosed template expression', at: { line, col } };
    }

    return { ok: true };
}

const htmlPath = process.argv[2] || 'index.html';
const html = fs.readFileSync(htmlPath, 'utf8');
const htmlLineStarts = getLineStarts(html);

const scriptRe = /<script>([\s\S]*?)<\/script>/gi;
const scripts = [];
let m;
while ((m = scriptRe.exec(html))) {
    scripts.push({
        js: m[1],
        htmlIndex: m.index
    });
}

if (scripts.length === 0) {
    console.log('No inline <script> blocks found');
    process.exit(0);
}

let hasError = false;

scripts.forEach((scr, idx) => {
    const htmlPos = indexToLineCol(htmlLineStarts, scr.htmlIndex);
    const filename = `${htmlPath}:inline-script-${idx + 1}`;

    try {
        new vm.Script(scr.js, { filename });
    } catch (e) {
        hasError = true;
        console.log(`\n[FAIL] Inline script #${idx + 1} (starts at HTML ${htmlPos.line}:${htmlPos.col})`);
        console.log(String(e));

        const scan = scanUnclosed(scr.js);
        if (!scan.ok) {
            console.log('Hint:', scan.reason);
            if (scan.open) {
                console.log('Open at script line/col:', scan.open.line + ':' + scan.open.col);
                console.log('Open stack tail:', scan.openStack || [scan.open]);
                console.log('Approx HTML open line:', htmlPos.line + scan.open.line);
            }
            if (scan.at) {
                console.log('Mismatch at script line/col:', scan.at.line + ':' + scan.at.col);
                console.log('Approx HTML mismatch line:', htmlPos.line + scan.at.line);
            }
        }

        const lines = scr.js.split(/\r?\n/);
        const focusLine = scan.at?.line || scan.open?.line || Math.max(1, lines.length);
        const start = Math.max(1, focusLine - 6);
        const end = Math.min(lines.length, focusLine + 6);
        console.log('--- script context ---');
        for (let ln = start; ln <= end; ln++) {
            console.log(String(ln).padStart(6) + ': ' + lines[ln - 1]);
        }
    }
});

if (!hasError) {
    console.log('OK: all inline <script> blocks parse');
}

process.exit(hasError ? 1 : 0);
