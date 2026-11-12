// Offline only: real validation/parser/token modules, mocked platform and storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
function load(source, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, URLSearchParams, require(name) { if (name === '@/lib/money') return require('./syp-test-loader.cjs').load('src/lib/money.ts'); if (!(name in mocks)) throw Error(`Unmocked import ${name}`); return mocks[name]; },
  });
  return exports;
}
const { parseRecoveryLink } = load(read('src/lib/password-recovery.ts'));
for (const url of [
  'taswoqalkarak://reset-password',
  'taswoqalkarak://reset-password#access_token=a&refresh_token=b',
  'taswoqalkarak://reset-password#type=signup&access_token=a&refresh_token=b',
  'https://other.example/reset-password#type=recovery&access_token=a&refresh_token=b',
  'taswoqalkarak://home#type=recovery&access_token=a&refresh_token=b',
  'taswoqalkarak://reset-password#error=expired&type=recovery&access_token=a&refresh_token=b',
]) assert.equal(parseRecoveryLink(url), null, 'Unrelated/expired links must not authorize a reset');
assert.equal(parseRecoveryLink('taswoqalkarak://reset-password#type=recovery&access_token=a&refresh_token=b').refresh_token, 'b');
assert.equal(parseRecoveryLink('exp://127.0.0.1:8081/--/reset-password#type=recovery&access_token=a&refresh_token=b').access_token, 'a');
assert.equal(parseRecoveryLink('taswoqalkarak://reset-password?type=recovery&token_hash=example').token_hash, 'example');

const valid = { store: 'متجر الحي' };

const platform = { Platform: { select: (values) => values.default ?? values.ios } };
const fonts = load(read('src/constants/fonts.ts'));
const mocks = { 'react-native': platform, './fonts': fonts };
const theme = load(read('src/constants/theme.ts'), mocks);
const oldTheme = load(execFileSync('git', ['show', 'HEAD:src/constants/theme.ts'], { cwd: root, encoding: 'utf8' }), mocks);
for (const name of ['LightColors', 'DarkColors', 'FontSizes', 'Spacing', 'Radius']) {
  for (const [key, value] of Object.entries(oldTheme[name])) {
    if(name==='LightColors'&&key==='textMuted')continue; // UX-02 intentionally fixes unreadable small text.
    assert.equal(theme[name][key], value, `Legacy ${name}.${key} changed`);
  }
}
assert.deepEqual(Object.keys(theme.LightColors).sort(), Object.keys(theme.DarkColors).sort());
function luminance(hex) {
  const values = hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
for (const colors of [theme.LightColors, theme.DarkColors]) {
  for(const surface of ['surface','background','surfaceSecondary'])assert(contrast(colors.textMuted,colors[surface])>=4.5,`muted text/${surface} contrast`);
  for (const [foreground, background] of [['onPrimary', 'primary'], ['onPrimary', 'primaryPressed'], ['onAccent', 'accent'], ['onError', 'error'], ['onError', 'errorPressed'], ['textSecondary', 'surface'], ...['success', 'warning', 'error', 'info'].map((name) => [`${name}Foreground`, `${name}Surface`])]) {
    assert(contrast(colors[foreground], colors[background]) >= 4.5, `${foreground}/${background} contrast`);
  }
  assert(contrast(colors.borderStrong, colors.surface) >= 3);
}
// The admin layout has accepted changes since the original onboarding snapshot.
// Keep the access contract here; test-ui-navigation exercises tab and safe-back behavior.
const adminLayout = read('src/app/admin/_layout.tsx');
assert.match(adminLayout, /<RoleRouteGuard role="admin">\s*<AdminLayoutContent\s*\/>\s*<\/RoleRouteGuard>/);
assert.match(adminLayout, /<AppHeader\b/);
assert.match(adminLayout, /<AppBottomNav\b/);
assert(!read('src/app/merchant-application.tsx').includes('supabase.rpc('));
assert(read('src/components/signup/ProfessionalApplicationScreen.tsx').includes('"submit_professional_onboarding"'));

(async () => {
  // Exercise the actual hook lock: two taps before React rerenders, then a retry.
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useCallback(callback) { return callback; },
  };
  let requests = 0;
  let complete;
  const { useSignup } = load(read('src/hooks/useSignup.ts'), {
    react, 'expo-router': { useRouter: () => ({ replace() {} }) },
    '@/lib/signup-data': load(read('src/lib/signup-data.ts')),
    '@/lib/account-routing': { getAccountRoute: async () => '/home', getAccountRoutingErrorMessage: () => 'routing-error' },
    '@/lib/supabase': { supabase: { rpc: async () => ({data:3,error:null}), auth: { signUp() { requests++; return new Promise((resolve) => { complete = resolve; }); } } } },
  });
  const render = () => { cursor = 0; return useSignup(); };
  let signup = render();
  for (const [field, value] of Object.entries({ fullName: 'اسم صحيح', email: 'person@example.test', password: 'password123', passwordConfirmation: 'password123', birthDate: '1995-06-15' })) signup.updateField(field, value);
  signup.setRole('customer'); signup.toggleAcceptedTerms();
  signup = render();
  const first = signup.createAccount();
  await signup.createAccount();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1, 'Repeated taps must share the synchronous submit lock');
  complete({ data: {}, error: { message: 'offline' } });
  await first;
  signup = render();
  const retry = signup.createAccount();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 2, 'A failed signup must release the lock for a retry');
  complete({ data: {}, error: { message: 'offline' } });
  await retry;

  slots.length = 0;
  const resetRequests = [];
  const { useLogin } = load(read('src/hooks/useLogin.ts'), {
    react, 'expo-router': { useRouter: () => ({ replace() {} }) },
    'expo-linking': { createURL: () => 'taswoqalkarak://reset-password' },
    '@/lib/account-routing': { getAccountRoute: async () => '/home', getAccountRoutingErrorMessage: () => 'routing-error' },
    '@/lib/supabase': { supabase: { auth: { async resetPasswordForEmail(email, options) { resetRequests.push({ email, options }); return { error: null }; } } } },
  });
  const renderLogin = () => { cursor = 0; return useLogin(); };
  let login = renderLogin();
  login.setEmail('login@example.test');
  login = renderLogin(); login.openReset();
  login = renderLogin(); assert.equal(login.resetEmail, 'login@example.test');
  login.changeResetEmail('  Recovery@Example.test  ');
  login = renderLogin(); await login.sendReset();
  assert.equal(resetRequests[0].email, 'recovery@example.test');
  assert.equal(resetRequests[0].options.redirectTo, 'taswoqalkarak://reset-password');
  login = renderLogin(); assert.equal(login.email, 'login@example.test'); assert(login.resetMessage);
  login.changeResetEmail('invalid'); login = renderLogin(); await login.sendReset();
  assert.equal(resetRequests.length, 1, 'Invalid modal email must not call Auth');
  login = renderLogin(); assert(login.resetError);

  let failWrite = false;
  const storage = new Map();
  const cache = load(read('src/lib/local-cache.ts'), { '@react-native-async-storage/async-storage': { __esModule: true, default: {
    async getItem(key) { return storage.get(key) ?? null; },
    async setItem(key, value) { if (failWrite) throw Error('disk-full'); storage.set(key, value); },
    async removeItem(key) { storage.delete(key); },
  } } });
  await cache.writeLocalCache('first', valid, { requirePersistence: true });
  assert.equal((await cache.readLocalCache('first')).store, valid.store);
  assert.equal(await cache.readLocalCache('second'), undefined);
  failWrite = true;
  await assert.rejects(cache.writeLocalCache('first', valid, { requirePersistence: true }), /disk-full/);
  await cache.writeLocalCache('legacy', valid); // Existing callers retain best-effort semantics.
  console.log('PASS: recovery links, theme compatibility/contrast, navigation preservation and storage failures.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
