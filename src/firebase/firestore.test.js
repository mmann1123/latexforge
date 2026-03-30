import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore functions
const mockAddDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => args.join('/')),
  doc: vi.fn((...args) => args.join('/')),
  addDoc: (...args) => mockAddDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  serverTimestamp: vi.fn(() => 'mock-ts'),
  query: vi.fn((...args) => args[0]),
  orderBy: vi.fn(),
  where: vi.fn(),
}));

vi.mock('./config.js', () => ({
  db: 'mock-db',
}));

import {
  createProject,
  getProjects,
  getSharedProjects,
  getProject,
  deleteProject,
  getFiles,
  getFile,
  createFile,
  updateFileContent,
  deleteFile,
  updateProjectName,
} from './firestore.js';

describe('firestore module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProject', () => {
    it('creates a project and a default main.tex file', async () => {
      mockAddDoc
        .mockResolvedValueOnce({ id: 'proj-123' })  // project doc
        .mockResolvedValueOnce({ id: 'file-1' });     // main.tex

      const id = await createProject('user-1', 'My Project');
      expect(id).toBe('proj-123');
      expect(mockAddDoc).toHaveBeenCalledTimes(2);

      // First call: project doc
      const projectData = mockAddDoc.mock.calls[0][1];
      expect(projectData.name).toBe('My Project');
      expect(projectData.ownerId).toBe('user-1');
      expect(projectData.collaborators).toEqual({});

      // Second call: main.tex file
      const fileData = mockAddDoc.mock.calls[1][1];
      expect(fileData.name).toBe('main.tex');
      expect(fileData.type).toBe('tex');
      expect(fileData.content).toContain('\\documentclass{article}');
    });
  });

  describe('getProjects', () => {
    it('returns projects for a user', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'p1', data: () => ({ name: 'A', ownerId: 'u1' }) },
          { id: 'p2', data: () => ({ name: 'B', ownerId: 'u1' }) },
        ],
      });

      const projects = await getProjects('u1');
      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({ id: 'p1', name: 'A', ownerId: 'u1' });
    });

    it('returns empty array when no projects', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      const projects = await getProjects('u1');
      expect(projects).toEqual([]);
    });
  });

  describe('getSharedProjects', () => {
    it('returns shared projects sorted by updatedAt descending', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'p1', data: () => ({ name: 'Old', updatedAt: { toMillis: () => 1000 } }) },
          { id: 'p2', data: () => ({ name: 'New', updatedAt: { toMillis: () => 2000 } }) },
        ],
      });

      const projects = await getSharedProjects('u1');
      expect(projects[0].name).toBe('New');
      expect(projects[1].name).toBe('Old');
    });

    it('handles missing updatedAt gracefully', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'p1', data: () => ({ name: 'No Date' }) },
        ],
      });

      const projects = await getSharedProjects('u1');
      expect(projects).toHaveLength(1);
    });
  });

  describe('getProject', () => {
    it('returns project data when it exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'proj-1',
        data: () => ({ name: 'Test', ownerId: 'u1' }),
      });

      const project = await getProject('proj-1');
      expect(project).toEqual({ id: 'proj-1', name: 'Test', ownerId: 'u1' });
    });

    it('returns null when project does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      const project = await getProject('nonexistent');
      expect(project).toBeNull();
    });
  });

  describe('deleteProject', () => {
    it('soft-deletes by setting deletedAt timestamp', async () => {
      mockUpdateDoc.mockResolvedValue();

      await deleteProject('proj-1');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc.mock.calls[0][1]).toHaveProperty('deletedAt');
    });
  });

  describe('getFiles', () => {
    it('returns files ordered by name', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'f1', data: () => ({ name: 'a.tex', type: 'tex' }) },
          { id: 'f2', data: () => ({ name: 'b.tex', type: 'tex' }) },
        ],
      });

      const files = await getFiles('proj-1');
      expect(files).toHaveLength(2);
      expect(files[0].id).toBe('f1');
    });
  });

  describe('getFile', () => {
    it('returns file when exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'f1',
        data: () => ({ name: 'main.tex', content: 'hello' }),
      });

      const file = await getFile('proj-1', 'f1');
      expect(file).toEqual({ id: 'f1', name: 'main.tex', content: 'hello' });
    });

    it('returns null when file does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      expect(await getFile('proj-1', 'missing')).toBeNull();
    });
  });

  describe('createFile', () => {
    it('creates a file with provided content', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-f1' });

      const id = await createFile('proj-1', 'chapter.tex', 'tex', '\\section{Intro}');
      expect(id).toBe('new-f1');
      expect(mockAddDoc.mock.calls[0][1]).toMatchObject({
        name: 'chapter.tex',
        type: 'tex',
        content: '\\section{Intro}',
      });
    });

    it('defaults to empty string when no content provided', async () => {
      mockAddDoc.mockResolvedValue({ id: 'f2' });

      await createFile('proj-1', 'empty.tex', 'tex');
      expect(mockAddDoc.mock.calls[0][1].content).toBe('');
    });
  });

  describe('updateFileContent', () => {
    it('updates file content and project updatedAt', async () => {
      mockUpdateDoc.mockResolvedValue();

      await updateFileContent('proj-1', 'f1', 'new content');
      expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
      // First call updates the file
      expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({ content: 'new content' });
    });
  });

  describe('deleteFile', () => {
    it('deletes the file document', async () => {
      mockDeleteDoc.mockResolvedValue();
      await deleteFile('proj-1', 'f1');
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateProjectName', () => {
    it('updates the project name and updatedAt', async () => {
      mockUpdateDoc.mockResolvedValue();
      await updateProjectName('proj-1', 'New Name');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'New Name' })
      );
    });
  });
});
