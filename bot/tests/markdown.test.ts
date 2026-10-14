import assert from 'node:assert/strict';
import { escapeMarkdown } from '../src/utils/markdown';

assert.equal(escapeMarkdown('plain text'), 'plain text');
assert.equal(escapeMarkdown('a_b*c[d]e(f)g`h\\i'), 'a\\_b\\*c\\[d\\]e\\(f\\)g\\`h\\\\i');

console.log('markdown escaping assertions passed');
