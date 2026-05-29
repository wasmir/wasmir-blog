import { defineConfig } from 'astro/config';

// GitHub Pages（项目页）：仓库名 = wasmir-blog。
// 若改用用户页仓库 <user>.github.io，则删掉 base、site 改成 https://<user>.github.io。
export default defineConfig({
  site: 'https://wasmir.github.io',
  base: '/wasmir-blog',
});
