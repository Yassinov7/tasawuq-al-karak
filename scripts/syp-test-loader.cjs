const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Intl, Date, Number, URL, URLSearchParams,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === '@/lib/money') return load('src/lib/money.ts');
      if (name.startsWith('@/lib/') && name !== '@/lib/supabase') return load(`src/lib/${name.slice(6)}.ts`, mocks);
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports;
}
module.exports = { load };
