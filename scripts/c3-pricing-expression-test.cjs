// Offline arithmetic evaluator for the exact expressions extracted from C3 SQL.
// This is deliberately NOT a PostgreSQL parser/executor or a security proof.
const assert = require('node:assert/strict');
const rational = (n, d = 1n) => ({ n, d });
function decimal(value) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match) throw Error('Non-finite or malformed decimal');
  return rational(BigInt((match[1] || '') + match[2] + (match[3] || '')), 10n ** BigInt((match[3] || '').length));
}
function evaluate(source, values = {}) {
  const tokens = source.match(/[a-z_][a-z_0-9.]*|\d+(?:\.\d+)?|[()+*/,\-]/gi) || [];
  assert.equal(tokens.join(''), source.replace(/\s/g, ''), 'unsupported SQL arithmetic');
  let position = 0;
  function take(token) { assert.equal(tokens[position++], token); }
  function atom() {
    const token = tokens[position++];
    if (token === '(') { const value = expression(); take(')'); return value; }
    if (token === '-') { const value = atom(); return rational(-value.n, value.d); }
    if (/^\d/.test(token || '')) return decimal(token);
    if (tokens[position] !== '(') {
      assert(Object.hasOwn(values, token), `missing SQL variable ${token}`);
      return typeof values[token] === 'object' ? values[token] : decimal(values[token]);
    }
    take('('); const args = [expression()];
    while (tokens[position] === ',') { position++; args.push(expression()); }
    take(')');
    if (token === 'round') {
      assert.equal(args.length, 2); assert.equal(args[1].d, 1n);
      const factor = 10n ** args[1].n, scaled = args[0].n * factor, sign = scaled < 0n ? -1n : 1n;
      const absolute = scaled * sign;
      return rational(sign * ((absolute * 2n + args[0].d) / (2n * args[0].d)), factor);
    }
    if (token === 'greatest') return args.reduce((a, b) => a.n * b.d >= b.n * a.d ? a : b);
    throw Error(`unsupported SQL function ${token}`);
  }
  function product() {
    let left = atom();
    while (tokens[position] === '*' || tokens[position] === '/') {
      const operation = tokens[position++], right = atom();
      if (operation === '/') { assert(right.n > 0n, 'positive divisor required'); left = rational(left.n * right.d, left.d * right.n); }
      else left = rational(left.n * right.n, left.d * right.d);
    }
    return left;
  }
  function expression() {
    let left = product();
    while (tokens[position] === '+' || tokens[position] === '-') {
      const operation = tokens[position++], right = product();
      left = rational(left.n * right.d + (operation === '+' ? 1n : -1n) * right.n * left.d, left.d * right.d);
    }
    return left;
  }
  const result = expression(); assert.equal(position, tokens.length); return result;
}
function cents(value) { assert.equal((value.n * 100n) % value.d, 0n); return value.n * 100n / value.d; }
function assignment(source, variable, marker = '') {
  const start = source.indexOf(marker); assert(start >= 0, `missing ${marker}`);
  const tail = source.slice(start + marker.length), match = new RegExp(`\\b${variable}\\s*:=\\s*([^;]+);`).exec(tail);
  assert(match, `missing assignment ${variable}`); return match[1];
}
// Balanced calls include nested round(...), arbitrary whitespace and multiline SQL.
function assertCentRounding(source) {
  const clean = source.replace(/--[^\n]*/g, ''); let found = 0;
  for (const match of clean.matchAll(/\bround\s*\(/gi)) {
    let depth = 1, comma = -1, end = match.index + match[0].length;
    for (; end < clean.length && depth; end++) {
      const ch = clean[end];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 1) comma = end;
    }
    assert.equal(depth, 0); assert(comma >= 0, 'explicit rounding boundary required');
    assert.equal(clean.slice(comma + 1, end - 1).trim(), '2', 'merchandise round must retain cents'); found++;
  }
  assert(found > 0);
}
function pricing(sql) {
  sql = sql.replace(/\r\n/g, '\n');
  const body = sql.split('create or replace function public.create_order_from_cart')[1].split('create or replace function public.make_order_delivery_available')[0];
  const percentage = assignment(body, 'item_final_total', "if offer_row.discount_method = 'percentage' then");
  const fixed = assignment(body, 'item_final_total', "elsif offer_row.discount_method = 'fixed_amount' then");
  const cumulative = assignment(body, 'cumulative_original_total', '-- Round cumulative shares');
  const bundle = assignment(body, 'item_final_total', 'item_final_total := offer_bundle_total - allocated_total;\n          else');
  const last = assignment(body, 'item_final_total', 'if offer_item_index = offer_item_count then');
  function allocate(originals, total) {
    const totalValue = decimal(total); assert(cents(totalValue) > 0n);
    const weights = originals.map(decimal); assert(weights.every(value => value.n >= 0n));
    const sum = weights.reduce((a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d), rational(0n)); assert(sum.n > 0n);
    let allocated = rational(0n), running = rational(0n);
    return weights.map((weight, index) => {
      const values = { item_original_total: weight, cumulative_original_total: running, offer_original_total: sum, offer_bundle_total: totalValue, allocated_total: allocated };
      running = evaluate(cumulative, values); values.cumulative_original_total = running;
      const amount = evaluate(index === weights.length - 1 ? last : bundle, values);
      assert(cents(amount) >= 0n); allocated = rational(allocated.n * amount.d + amount.n * allocated.d, allocated.d * amount.d);
      if (index === weights.length - 1) assert.equal(cents(allocated), cents(totalValue));
      return cents(amount);
    });
  }
  return { body, percentage, fixed, allocate };
}
module.exports = { evaluate, cents, pricing, assertCentRounding };
