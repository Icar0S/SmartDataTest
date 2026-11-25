/**
 * @jest-environment node
 */

/**
 * Frontend Security Tests
 *
 * Verifies that the React frontend follows security best practices:
 * 1. No API keys or secrets stored in localStorage / sessionStorage
 * 2. API calls use HTTPS or relative URLs (no hardcoded http://)
 * 3. LLM-generated content is NOT rendered with dangerouslySetInnerHTML without sanitisation
 * 4. No direct imports of .env files containing secrets
 * 5. Nothing shipped to the browser authenticates anyone by itself
 *
 * OWASP Reference: A02:2021 – Cryptographic Failures / A03 – Injection
 */

const fs = require('fs');
const path = require('path');

// Resolve paths relative to this file's location:
// tests/frontend/security/ → up 3 dirs → repo root → frontend/src
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const FRONTEND_SRC = path.join(REPO_ROOT, 'frontend', 'src');

/**
 * Recursively collect all .js and .jsx files under a directory.
 */
function collectJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(fullPath));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const allSrcFiles = collectJsFiles(FRONTEND_SRC);

// ── 1. No sensitive data in localStorage / sessionStorage ─────────────────────
//
// The one exception is the session of the person using the browser, kept by
// utils/authStorage.js: opaque, short-lived, and revocable by the server. API
// keys and shared secrets have no such excuse.

describe('[Security] localStorage / sessionStorage – no secrets', () => {
  const SENSITIVE_STORAGE_PATTERNS = [
    /localStorage\.setItem\s*\(\s*['"](?:api[_-]?key|token|secret|password|GEMINI|ANTHROPIC)['"]/i,
    /sessionStorage\.setItem\s*\(\s*['"](?:api[_-]?key|token|secret|password|GEMINI|ANTHROPIC)['"]/i,
  ];

  test('no sensitive keys stored in localStorage', () => {
    const violations = [];
    for (const filePath of allSrcFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const pattern of SENSITIVE_STORAGE_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(path.relative(REPO_ROOT, filePath));
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('no API tokens stored in sessionStorage', () => {
    const pattern = /sessionStorage\.setItem\s*\(\s*['"][^'"]*(?:key|token|secret)['"]/i;
    const violations = allSrcFiles.filter(f =>
      pattern.test(fs.readFileSync(f, 'utf-8'))
    );
    expect(violations.map(f => path.relative(REPO_ROOT, f))).toEqual([]);
  });
});

// ── 2. API calls use HTTPS or relative URLs ───────────────────────────────────

describe('[Security] API URLs – no hardcoded plain HTTP', () => {
  // Matches fetch("http://...") or axios.get("http://...") with non-localhost target
  const HTTP_CALL_PATTERN = /(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*['"]http:\/\/(?!localhost|127\.0\.0\.1)/;

  test.each(allSrcFiles)('no plain http:// API calls in %s', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = HTTP_CALL_PATTERN.exec(content);
    if (match) {
      throw new Error(
        `[SECURITY] Hardcoded http:// API call in ${path.relative(REPO_ROOT, filePath)}: ` +
        `"${match[0]}". Use HTTPS or a relative URL. ` +
        'OWASP A02 – Cryptographic Failures.'
      );
    }
  });

  test('config/api.js does not hardcode an http:// base URL', () => {
    const apiConfigPath = path.join(FRONTEND_SRC, 'config', 'api.js');
    if (!fs.existsSync(apiConfigPath)) return;
    const content = fs.readFileSync(apiConfigPath, 'utf-8');
    // apiUrl should use env var, not a hardcoded http string
    expect(content).not.toMatch(/apiUrl\s*:\s*['"]http:\/\/(?!localhost)/);
  });
});

// ── 3. No unsanitised dangerouslySetInnerHTML with dynamic LLM content ─────────

describe('[Security] dangerouslySetInnerHTML – no unsanitised use', () => {
  const DANGEROUS_PATTERN = /dangerouslySetInnerHTML\s*=\s*\{\s*\{/;

  test('dangerouslySetInnerHTML is not used without DOMPurify sanitisation', () => {
    const SAFE_SANITIZERS = ['DOMPurify', 'sanitizeHtml', 'sanitize-html', 'xss'];

    const violations = [];
    for (const filePath of allSrcFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (DANGEROUS_PATTERN.test(content)) {
        const hasSanitizer = SAFE_SANITIZERS.some(s => content.includes(s));
        if (!hasSanitizer) {
          violations.push(path.relative(REPO_ROOT, filePath));
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        '[SECURITY] dangerouslySetInnerHTML used without sanitisation in:\n' +
        violations.map(f => `  ${f}`).join('\n') +
        '\nLLM-generated content rendered as raw HTML enables XSS attacks. ' +
        'Use DOMPurify.sanitize() before passing to dangerouslySetInnerHTML. ' +
        'OWASP A03 – Injection / XSS.'
      );
    }

    expect(violations).toEqual([]);
  });
});

// ── 4. No direct .env imports or hardcoded secrets in source ─────────────────

describe('[Security] No hardcoded secrets in frontend source', () => {
  const SECRET_PATTERNS = [
    /require\s*\(\s*['"]\.env['"]\s*\)/,
    /import\s+.*from\s+['"]\.env['"]/,
    /\bsk-[A-Za-z0-9]{20,}/,      // OpenAI / Anthropic key
    /\bAIza[A-Za-z0-9_\-]{35}/,   // Google API key
  ];

  test('no .env file imports or hardcoded key patterns in frontend source', () => {
    const violations = [];
    for (const filePath of allSrcFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(REPO_ROOT, filePath)} (pattern: ${pattern})`);
          break;
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('REACT_APP_API_URL is used for API base URL, not a hardcoded value', () => {
    const apiConfigPath = path.join(FRONTEND_SRC, 'config', 'api.js');
    if (!fs.existsSync(apiConfigPath)) return;
    const content = fs.readFileSync(apiConfigPath, 'utf-8');
    expect(content).toMatch(/process\.env\.REACT_APP_API_URL/);
  });
});

// ── 5. Nothing in the bundle authenticates anyone ─────────────────────────────
//
// Everything under src/ is shipped to every visitor. The login used to be a list
// of users with plain passwords compared in the browser, next to an API token
// inlined at build time: neither protected anything, and both were public.

describe('[Security] No credentials shipped to the browser', () => {
  const source = allSrcFiles.map((f) => [path.relative(REPO_ROOT, f), fs.readFileSync(f, 'utf-8')]);

  test.each([
    ['a password written as a literal', /\bpassword\s*[:=]\s*['"][^'"]+['"]/i],
    ['the demo passwords', /admin123|engineer123|qa123456/],
    ['a password field', /type=["']password["']/],
    ['a credential in a build-time variable', /REACT_APP_[A-Z_]*(?:TOKEN|SECRET|PASSWORD|KEY)/],
  ])('%s', (_name, pattern) => {
    expect(source.filter(([, content]) => pattern.test(content)).map(([name]) => name)).toEqual([]);
  });

  test('the list of users is gone', () => {
    expect(fs.existsSync(path.join(FRONTEND_SRC, 'data', 'users.js'))).toBe(false);
  });

  test('the production build configuration carries no credential', () => {
    const env = fs.readFileSync(path.join(REPO_ROOT, 'frontend', '.env.production'), 'utf-8');
    const assignments = env.split('\n').filter((line) => /^[A-Z]/.test(line));
    expect(assignments.filter((line) => /TOKEN|SECRET|PASSWORD|KEY/.test(line))).toEqual([]);
  });
});

// ── 6. Content-Security-Policy ────────────────────────────────────────────────
//
// The session token is within reach of the page's JavaScript (docs/AUTH.md says
// why), so what has to be contained is XSS: foreign scripts, inline scripts, and
// sending data anywhere but the API.

describe('[Security] Content-Security-Policy', () => {
  const read = (...parts) => fs.readFileSync(path.join(REPO_ROOT, 'frontend', ...parts), 'utf-8');
  const rule = JSON.parse(read('vercel.json')).headers[0];
  const header = (name) => rule.headers.find((h) => h.key === name)?.value;
  const directives = Object.fromEntries(
    header('Content-Security-Policy')
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .map(([name, ...values]) => [name, values])
  );

  test('covers every page', () => {
    expect(rule.source).toBe('/(.*)');
  });

  test('only runs scripts from the site itself', () => {
    expect(directives['script-src']).toEqual(["'self'"]);
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
  });

  test('only talks to the site and to the API it was built for', () => {
    const api = read('.env.production').match(/^REACT_APP_API_URL=(.+)$/m)[1].trim();
    expect(directives['connect-src']).toEqual(["'self'", api]);
  });

  test('cannot be framed', () => {
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(header('X-Frame-Options')).toBe('DENY');
  });

  test('reaches production through the CD pipeline only', () => {
    // Vercel's Git integration published main about a minute after a merge,
    // before the CI finished, whatever its result. The CD deploys with the CLI,
    // which this setting does not affect; previews of other branches stay.
    const { deploymentEnabled } = JSON.parse(read('vercel.json')).git;
    expect(deploymentEnabled).toEqual({ main: false });
  });

  test('is part of the repository', () => {
    // It used to be git-ignored, in which case none of this would be deployed.
    expect(read('.gitignore').split('\n')).not.toContain('vercel.json');
  });
});

// ── 7. Verify frontend source directory exists ────────────────────────────────

describe('[Security] Frontend source structure', () => {
  test('frontend/src directory exists', () => {
    expect(fs.existsSync(FRONTEND_SRC)).toBe(true);
  });

  test('at least one JS source file found to analyse', () => {
    expect(allSrcFiles.length).toBeGreaterThan(0);
  });
});
