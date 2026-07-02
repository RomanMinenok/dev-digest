import { describe, it, expect } from 'vitest';
import type { PrDetail } from '@devdigest/shared';
import { MockGitClient } from '../../adapters/mocks.js';
import { resolveSpecContext } from './spec-resolver.js';

const REPO = { owner: 'acme', name: 'widgets' };

describe('resolveSpecContext', () => {
  it('no body, no linked issue, no changed files → empty context, no throw', async () => {
    const git = new MockGitClient();
    const result = await resolveSpecContext({
      repo: REPO,
      body: null,
      prDetail: { linked_issue: null, files: [] },
      git,
    });

    expect(result.contextText).toBe('');
    expect(result.sources).toEqual([]);
  });

  it('resolves a PR-added markdown file via git.readFile', async () => {
    const git = new MockGitClient({ files: { 'docs/spec.md': 'The spec says X.' } });
    const result = await resolveSpecContext({
      repo: REPO,
      body: null,
      prDetail: {
        linked_issue: null,
        files: [{ path: 'docs/spec.md', additions: 5, deletions: 0, patch: null }],
      },
      git,
    });

    expect(result.contextText).toContain('The spec says X.');
    expect(result.sources).toContainEqual({ type: 'pr_md', ref: 'docs/spec.md', included: true });
  });

  it('resolves a repo markdown file referenced in the PR body', async () => {
    const git = new MockGitClient({ files: { 'docs/plan/foo.md': 'Plan content here.' } });
    const result = await resolveSpecContext({
      repo: REPO,
      body: 'See [the plan](docs/plan/foo.md) for details.',
      prDetail: { linked_issue: null, files: [] },
      git,
    });

    expect(result.contextText).toContain('Plan content here.');
    expect(result.sources).toContainEqual({ type: 'repo_md', ref: 'docs/plan/foo.md', included: true });
  });

  it('records an unresolvable referenced .md file as reference-only, never throws', async () => {
    const git = new MockGitClient({ files: {} }); // readFile returns '' for missing paths
    const result = await resolveSpecContext({
      repo: REPO,
      body: 'See [the plan](docs/plan/missing.md) for details.',
      prDetail: { linked_issue: null, files: [] },
      git,
    });

    expect(result.sources).toContainEqual({ type: 'repo_md', ref: 'docs/plan/missing.md', included: false });
    expect(result.contextText).not.toContain('missing.md');
  });

  it('never throws when git.readFile rejects', async () => {
    const git = new MockGitClient();
    git.readFile = async () => {
      throw new Error('clone unavailable');
    };

    const result = await resolveSpecContext({
      repo: REPO,
      body: 'See [the plan](docs/plan/foo.md).',
      prDetail: { linked_issue: null, files: [] },
      git,
    });

    expect(result.sources).toContainEqual({ type: 'repo_md', ref: 'docs/plan/foo.md', included: false });
  });

  it('includes the linked issue as context', async () => {
    const git = new MockGitClient();
    const linkedIssue: NonNullable<PrDetail['linked_issue']> = {
      number: 471,
      title: 'Rate limit the public API',
      body: 'We need a token bucket limiter.',
      state: 'open',
    };
    const result = await resolveSpecContext({
      repo: REPO,
      body: 'Closes #471.',
      prDetail: { linked_issue: linkedIssue, files: [] },
      git,
    });

    expect(result.contextText).toContain('Rate limit the public API');
    expect(result.contextText).toContain('token bucket limiter');
    expect(result.sources).toContainEqual({ type: 'linked_issue', ref: '#471', included: true });
  });

  it('fetches an allowlisted external URL via the injected fetcher', async () => {
    const git = new MockGitClient();
    const result = await resolveSpecContext({
      repo: REPO,
      body: 'Background: https://gist.github.com/acme/abc123',
      prDetail: { linked_issue: null, files: [] },
      git,
      fetch: async (url) => (url.includes('gist.github.com') ? 'Gist content.' : null),
    });

    expect(result.contextText).toContain('Gist content.');
    expect(result.sources).toContainEqual({
      type: 'external_url',
      ref: 'https://gist.github.com/acme/abc123',
      included: true,
    });
  });

  it('records a non-allowlisted / blocked external URL as reference-only when the fetcher returns null', async () => {
    const git = new MockGitClient();
    const result = await resolveSpecContext({
      repo: REPO,
      body: 'Background: https://evil.example.com/steal',
      prDetail: { linked_issue: null, files: [] },
      git,
      fetch: async () => null,
    });

    expect(result.sources).toContainEqual({
      type: 'external_url',
      ref: 'https://evil.example.com/steal',
      included: false,
    });
    expect(result.contextText).not.toContain('steal');
  });

  it('truncates once the ~30KB total budget is exceeded, recording overflow sources as reference-only', async () => {
    const bigContent = 'x'.repeat(20 * 1024);
    const git = new MockGitClient({
      files: {
        'docs/plan/a.md': bigContent,
        'docs/plan/b.md': bigContent,
      },
    });
    const result = await resolveSpecContext({
      repo: REPO,
      body: 'See [a](docs/plan/a.md) and [b](docs/plan/b.md).',
      prDetail: { linked_issue: null, files: [] },
      git,
    });

    const included = result.sources.filter((s) => s.included);
    const excluded = result.sources.filter((s) => !s.included);
    expect(included).toHaveLength(1);
    expect(excluded).toHaveLength(1);
    expect(result.contextText).toContain('[...truncated: spec context budget exceeded...]');
  });
});
