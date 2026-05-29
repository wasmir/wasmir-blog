import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export type ProjectStatus = 'todo' | 'doing' | 'finish' | 'dropped';
export interface Project {
  name: string;
  blurb: string;
  status: ProjectStatus;
  progress?: number;
  link?: string;     // finish 项目有 link 时，右侧 meta 轨显示「打开」动作
  platform?: string; // 平台/类型微标签：macOS / iOS / 工作流 / 网页 …
}

export type LearningStatus = 'done' | 'learning';
export interface Learning {
  topic: string;
  status: LearningStatus;
  progress?: number;
  via?: string; // 来源 / 作者，显示为名字下方的小字
}

const PROJECT_ORDER: Record<ProjectStatus, number> = {
  doing: 0,
  todo: 1,
  finish: 2,
  dropped: 3,
};

export function sortProjects(list: Project[]): Project[] {
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => PROJECT_ORDER[a.p.status] - PROJECT_ORDER[b.p.status] || a.i - b.i)
    .map((x) => x.p);
}

export function groupLearning(list: Learning[]): { done: Learning[]; learning: Learning[] } {
  return {
    done: list.filter((l) => l.status === 'done'),
    learning: list.filter((l) => l.status === 'learning'),
  };
}

export function loadProjects(): Project[] {
  const raw = fs.readFileSync(path.resolve(process.cwd(), 'src/data/projects.yaml'), 'utf8');
  return sortProjects((yaml.load(raw) as Project[]) ?? []);
}

export function loadLearning(): { done: Learning[]; learning: Learning[] } {
  const raw = fs.readFileSync(path.resolve(process.cwd(), 'src/data/learning.yaml'), 'utf8');
  return groupLearning((yaml.load(raw) as Learning[]) ?? []);
}
