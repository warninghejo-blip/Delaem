import fs from 'node:fs';

const filePath = process.argv[2] || 'tmp_js.js';
const src = fs.readFileSync(filePath, 'utf8');

const ctxStack = ['code'];
const bracketStack = []; // {ch,line,col, templateExprOpen?:boolean}

let line = 1;
let col = 0;

let identBuf = '';
let lastIdent = '';

const REGEX_KEYWORDS = new Set([
    'return',
    'case',
    'throw',
    'typeof',
    'instanceof',
    'in',
    'of',
    'void',
    'delete',
    'new'
]);

function flushIdent() {
    if (identBuf) {
        lastIdent = identBuf;
        identBuf = '';
    }
}

function topCtx() {
    return ctxStack[ctxStack.length - 1];
}

function pushBracket(ch, extra = {}) {
    bracketStack.push({ ch, line, col, ...extra });
}

function popBracket(closeCh) {
    const t = bracketStack.pop();
    if (!t) {
        return { type: 'extra_close', closeCh, at: { line, col } };
    }
    const ok =
        (t.ch === '{' && closeCh === '}') || (t.ch === '(' && closeCh === ')') || (t.ch === '[' && closeCh === ']');
    if (!ok) {
        return { type: 'mismatch', open: t, closeCh, at: { line, col } };
    }
    return { type: 'ok', open: t };
}

for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];

    if (c === '\n') {
        line++;
        col = 0;
    } else {
        col++;
    }

    const ctx = topCtx();

    // Track identifiers in code-like contexts to help detect regex literals.
    if (ctx === 'code' || ctx === 'template_expr') {
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === '$') {
            identBuf += c;
        } else {
            flushIdent();
        }
    }

    if (ctx === 'line_comment') {
        if (c === '\n') ctxStack.pop();
        continue;
    }

    if (ctx === 'block_comment') {
        if (c === '*' && n === '/') {
            ctxStack.pop();
            i++;
            col++;
        }
        continue;
    }

    if (ctx === 'single') {
        if (c === '\\') {
            i++;
            col++;
            continue;
        }
        if (c === "'") ctxStack.pop();
        continue;
    }

    if (ctx === 'double') {
        if (c === '\\') {
            i++;
            col++;
            continue;
        }
        if (c === '"') ctxStack.pop();
        continue;
    }

    if (ctx === 'regex') {
        // Consume regex literal until the next unescaped '/' (respecting character classes)
        if (c === '\\') {
            i++;
            col++;
            continue;
        }
        if (c === '[') {
            ctxStack.push('regex_charclass');
            continue;
        }
        if (c === '/') {
            // end regex, also consume flags
            ctxStack.pop();
            while (i + 1 < src.length) {
                const f = src[i + 1];
                if ((f >= 'a' && f <= 'z') || (f >= 'A' && f <= 'Z')) {
                    i++;
                    col++;
                    continue;
                }
                break;
            }
            continue;
        }
        continue;
    }

    if (ctx === 'regex_charclass') {
        // Inside [...], only ']' ends charclass. Escapes still apply.
        if (c === '\\') {
            i++;
            col++;
            continue;
        }
        if (c === ']') {
            ctxStack.pop();
            continue;
        }
        continue;
    }

    if (ctx === 'template') {
        if (c === '\\') {
            i++;
            col++;
            continue;
        }
        if (c === '`') {
            ctxStack.pop();
            continue;
        }
        if (c === '$' && n === '{') {
            // enter template expression
            ctxStack.push('code');
            ctxStack.push('template_expr');
            pushBracket('{', { templateExprOpen: true });
            i++;
            col++;
            continue;
        }
        continue;
    }

    // code contexts: 'code' or 'template_expr'
    if (c === '/' && n === '/') {
        ctxStack.push('line_comment');
        i++;
        col++;
        continue;
    }
    if (c === '/' && n === '*') {
        ctxStack.push('block_comment');
        i++;
        col++;
        continue;
    }

    // Regex literal detection (heuristic).
    if (c === '/' && n !== '/' && n !== '*') {
        // Look back for a previous non-whitespace char.
        let j = i - 1;
        while (j >= 0 && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n' || src[j] === '\r')) j--;
        const prev = j >= 0 ? src[j] : '';

        const prevAllowsRegex =
            prev === '' ||
            prev === '(' ||
            prev === '[' ||
            prev === '{' ||
            prev === ',' ||
            prev === ';' ||
            prev === ':' ||
            prev === '=' ||
            prev === '!' ||
            prev === '&' ||
            prev === '|' ||
            prev === '?' ||
            prev === '+' ||
            prev === '-' ||
            prev === '*' ||
            prev === '%' ||
            prev === '^' ||
            prev === '~' ||
            prev === '<' ||
            prev === '>' ||
            prev === '\n' ||
            REGEX_KEYWORDS.has(lastIdent);

        if (prevAllowsRegex) {
            ctxStack.push('regex');
            continue;
        }
    }
    if (c === "'") {
        ctxStack.push('single');
        continue;
    }
    if (c === '"') {
        ctxStack.push('double');
        continue;
    }
    if (c === '`') {
        ctxStack.push('template');
        continue;
    }

    if (c === '{' || c === '(' || c === '[') {
        pushBracket(c);
        continue;
    }

    if (c === '}' || c === ')' || c === ']') {
        const res = popBracket(c);
        if (res.type === 'extra_close' || res.type === 'mismatch') {
            console.log('ERROR', res);
            process.exit(1);
        }

        // if we just closed a template expression open brace, exit template_expr
        if (res.open && res.open.templateExprOpen) {
            // pop until we remove template_expr marker
            while (ctxStack.length && topCtx() !== 'template_expr') ctxStack.pop();
            if (topCtx() === 'template_expr') ctxStack.pop();
            // pop the 'code' that was pushed before template_expr
            if (topCtx() === 'code') ctxStack.pop();
        }
        continue;
    }
}

flushIdent();

console.log('EOF');
console.log('ctxStackTail', ctxStack.slice(-6));
console.log('openBrackets', bracketStack.length);
console.log('openTail', bracketStack.slice(-10));

if (bracketStack.length) {
    const t = bracketStack[bracketStack.length - 1];
    console.log('TOP_UNCLOSED', t);
    const lines = src.split(/\r?\n/);
    const start = Math.max(1, t.line - 8);
    const end = Math.min(lines.length, t.line + 8);
    console.log('--- context ---');
    for (let ln = start; ln <= end; ln++) {
        console.log(String(ln).padStart(6) + ': ' + lines[ln - 1]);
    }
}

if (ctxStack.length !== 1 || ctxStack[0] !== 'code') {
    console.log('UNCLOSED_CONTEXT', ctxStack);
}

process.exit(bracketStack.length || ctxStack.length !== 1 ? 1 : 0);
