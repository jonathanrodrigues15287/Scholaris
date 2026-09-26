const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadUtilities() {
  const context = {
    window: {},
    document: {
      createElement() {
        return {
          appendChild(node) {
            this.innerHTML = node.textContent
              .replaceAll('&', '&amp;')
              .replaceAll('<', '&lt;')
              .replaceAll('>', '&gt;')
              .replaceAll('"', '&quot;')
              .replaceAll("'", '&#39;');
          }
        };
      },
      createTextNode(textContent) { return { textContent: String(textContent) }; }
    },
    console
  };
  vm.runInNewContext(
    fs.readFileSync('frontend/js/utils.js', 'utf8'),
    context,
    { filename: 'frontend/js/utils.js' }
  );
  return context.window.ScholarisUtils;
}

test('publishes the shared utility API', () => {
  const utilities = loadUtilities();
  assert.equal(typeof utilities.escapeHtml, 'function');
  assert.equal(typeof utilities.createId, 'function');
  assert.equal(typeof utilities.parseJson, 'function');
  assert.equal(typeof utilities.formatDate, 'function');
  assert.equal(typeof utilities.debounce, 'function');
});

test('escapes HTML and parses JSON with a fallback', () => {
  const utilities = loadUtilities();
  assert.equal(utilities.escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(JSON.stringify(utilities.parseJson('{"ok":true}', {})), '{"ok":true}');
  assert.equal(JSON.stringify(utilities.parseJson('invalid', { ok: false })), '{"ok":false}');
});

test('creates prefixed IDs', () => {
  const id = loadUtilities().createId('subject');
  assert.match(id, /^subject-/);
});
