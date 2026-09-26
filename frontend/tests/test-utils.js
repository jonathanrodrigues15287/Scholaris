const fs = require('node:fs');
const vm = require('node:vm');

function loadBusiness() {
  const context = { window: {}, console };
  vm.runInNewContext(
    fs.readFileSync('frontend/js/core/business.js', 'utf8'),
    context,
    { filename: 'frontend/js/core/business.js' }
  );
  return context.window.Scholaris.utils.business;
}

module.exports = { loadBusiness };
