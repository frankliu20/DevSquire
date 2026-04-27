#!/usr/bin/env node
/**
 * Validates that the compiled dashboard HTML contains syntactically valid JS.
 * Run after `npm run compile` to catch quote-escaping bugs in template literals.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const bundlePath = path.join(__dirname, '..', 'dist', 'extension.js');
if (!fs.existsSync(bundlePath)) {
  console.error('ERROR: dist/extension.js not found. Run esbuild first.');
  process.exit(1);
}

// Load the bundle with a mock `vscode` module so it doesn't crash
const code = fs.readFileSync(bundlePath, 'utf-8');

// Extract getDashboardHtml by finding its output in the source.
// The function concatenates strings into an HTML doc. We can call it
// by pulling the compiled function out of the bundle.
//
// Strategy: regex-extract the full HTML template from the bundle source.
// The template starts with `<!DOCTYPE html>` and ends with `</html>`.
// In esbuild's output the template literal is preserved, so we need to
// evaluate it in a context where the interpolated vars are defined.

// Find the template literal that produces the dashboard HTML
const tmplMatch = code.match(/return\s*`(<!DOCTYPE html>[\s\S]*?<\/html>)`/);
if (!tmplMatch) {
  console.error('ERROR: Could not find dashboard HTML template in bundle');
  process.exit(1);
}

// Evaluate the template with dummy values for owner/repo/defaultMode
let html;
try {
  const fn = new Function('owner', 'repo', 'defaultMode', 'return `' + tmplMatch[1] + '`');
  html = fn('test', 'test', 'auto');
} catch (e) {
  console.error('ERROR: Failed to evaluate dashboard HTML template:', e.message);
  process.exit(1);
}

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('ERROR: No <script> tag found in dashboard HTML');
  process.exit(1);
}

try {
  new Function(scriptMatch[1]);
  console.log('✓ Dashboard webview JS syntax OK');
} catch (e) {
  console.error('ERROR: Dashboard webview JS has a syntax error — this will break the entire UI!');
  console.error(e.message);
  const lines = scriptMatch[1].split('\n');
  const lineMatch = e.stack && e.stack.match(/<anonymous>:(\d+)/);
  if (lineMatch) {
    const lineNum = parseInt(lineMatch[1]);
    const start = Math.max(0, lineNum - 3);
    const end = Math.min(lines.length, lineNum + 2);
    console.error('\nNear line ' + lineNum + ':');
    for (let i = start; i < end; i++) {
      console.error((i === lineNum - 1 ? '>>> ' : '    ') + (i + 1) + ': ' + lines[i]);
    }
  }
  console.error("\nHint: In template literals (backtick strings), use \\\\' not \\' to emit a literal single quote.");
  process.exit(1);
}
