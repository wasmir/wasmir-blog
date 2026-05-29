import { describe, it, expect } from 'vitest';
import { sortProjects, groupLearning, type Project, type Learning } from './content';

describe('sortProjects', () => {
  it('按 doing → todo → finish → dropped 排序，组内保持原序', () => {
    const input: Project[] = [
      { name: 'a', blurb: '', status: 'finish' },
      { name: 'b', blurb: '', status: 'doing', progress: 70 },
      { name: 'c', blurb: '', status: 'dropped' },
      { name: 'd', blurb: '', status: 'todo' },
      { name: 'e', blurb: '', status: 'doing', progress: 40 },
    ];
    expect(sortProjects(input).map(p => p.name)).toEqual(['b', 'e', 'd', 'a', 'c']);
  });
});

describe('groupLearning', () => {
  it('拆成 done / learning 两组，组内保持原序', () => {
    const input: Learning[] = [
      { topic: 'RAG', status: 'done', progress: 100 },
      { topic: 'Evals', status: 'learning', progress: 45 },
      { topic: 'MCP', status: 'done', progress: 100 },
    ];
    const { done, learning } = groupLearning(input);
    expect(done.map(l => l.topic)).toEqual(['RAG', 'MCP']);
    expect(learning.map(l => l.topic)).toEqual(['Evals']);
  });
});
