import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import {
  extractFromArchive,
  extractFromMarkdown,
  isBodyChange,
  parseFrontmatter,
} from './helpers.js';
import { BadRequestError } from '../../platform/errors.js';

/**
 * Pure helpers — extraction + the body-version-bump rule. No DB, so these run
 * without Docker.
 */
describe('skills helpers', () => {
  describe('parseFrontmatter', () => {
    it('parses simple key: value pairs and strips the fence', () => {
      const md = '---\nname: My Skill\ntype: rubric\n---\n# Heading\n\nBody text.';
      const { attrs, body } = parseFrontmatter(md);
      expect(attrs).toEqual({ name: 'My Skill', type: 'rubric' });
      expect(body).toBe('# Heading\n\nBody text.');
    });

    it('returns the whole text as body when there is no fence', () => {
      const md = '# Just a heading\n\nNo frontmatter.';
      const { attrs, body } = parseFrontmatter(md);
      expect(attrs).toEqual({});
      expect(body).toBe(md);
    });

    it('strips surrounding quotes from scalar values', () => {
      const { attrs } = parseFrontmatter('---\ndescription: "quoted value"\n---\nbody');
      expect(attrs.description).toBe('quoted value');
    });
  });

  describe('extractFromMarkdown', () => {
    it('prefers frontmatter attrs for name/description/type', () => {
      const md =
        '---\nname: Front Name\ndescription: Front Desc\ntype: security\n---\n# H1\n\nPara.';
      const ex = extractFromMarkdown(md);
      expect(ex).toMatchObject({
        name: 'Front Name',
        description: 'Front Desc',
        type: 'security',
        source: 'extracted',
      });
      expect(ex.body).toBe('# H1\n\nPara.');
    });

    it('falls back to first H1 / first paragraph / custom type', () => {
      const ex = extractFromMarkdown('# Title Heading\n\nThe description paragraph.\n\nMore.');
      expect(ex.name).toBe('Title Heading');
      expect(ex.description).toBe('The description paragraph.');
      expect(ex.type).toBe('custom');
    });

    it('coerces an unknown frontmatter type to custom', () => {
      const ex = extractFromMarkdown('---\ntype: bogus\n---\n# X\n\nP');
      expect(ex.type).toBe('custom');
    });
  });

  describe('extractFromArchive', () => {
    it('picks SKILL.md and ignores executable/.sh entries', () => {
      const zip = new AdmZip();
      zip.addFile('SKILL.md', Buffer.from('# Archived Skill\n\nThe rule.'));
      zip.addFile('install.sh', Buffer.from('#!/bin/sh\nrm -rf /'));
      zip.addFile('bin/tool', Buffer.from('\x7fELF binary'));
      const ex = extractFromArchive(zip.toBuffer());
      expect(ex.name).toBe('Archived Skill');
      expect(ex.body).toContain('The rule.');
      expect(ex.body).not.toContain('rm -rf');
      expect(ex.source).toBe('extracted');
    });

    it('falls back to the first *.md when no SKILL.md exists', () => {
      const zip = new AdmZip();
      zip.addFile('docs/readme.md', Buffer.from('# Readme Skill\n\nBody'));
      const ex = extractFromArchive(zip.toBuffer());
      expect(ex.name).toBe('Readme Skill');
    });

    it('throws BadRequestError when the archive has no markdown', () => {
      const zip = new AdmZip();
      zip.addFile('script.sh', Buffer.from('echo hi'));
      expect(() => extractFromArchive(zip.toBuffer())).toThrow(BadRequestError);
    });
  });

  describe('isBodyChange', () => {
    it('is true only when body is present and different', () => {
      expect(isBodyChange({ body: 'a' }, { body: 'b' })).toBe(true);
      expect(isBodyChange({ body: 'a' }, { body: 'a' })).toBe(false);
      expect(isBodyChange({ body: 'a' }, {})).toBe(false);
    });
  });
});
