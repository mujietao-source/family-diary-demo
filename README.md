# 家庭小日记 · 公开演示版

一个帮助三位家庭成员记录当天进展和下一步计划的轻量网页应用。支持中午、晚间两次记录、家庭日报和月历回看。

## 本地演示

```bash
npm install
npm run dev
```

默认不连接任何云端服务。输入任意四位演示访问码即可体验；记录只保存在当前浏览器的 `localStorage` 中，不会读取或写入真实家庭数据。清除浏览器站点数据即可删除演示记录。

## 项目结构

- `cloudbase-web/`：React + TypeScript 前端。
- `cloudbase-web/src/mockApi.ts`：浏览器本地演示数据层。
- `cloudbase-functions/familyDiaryApi/`：腾讯云开发云函数示例。

## 连接自己的云端环境

1. 在腾讯云开发中创建数据库集合 `reflections` 并部署云函数。
2. 在云函数环境变量中设置新的 `FAMILY_PIN`。仓库中不提供真实访问码。
3. 复制 `.env.example` 为 `.env.local`，设置你自己的 `VITE_DIARY_API_URL`。
4. 运行 `npm run build`，按你的云开发环境部署 `dist/`。

共享四位访问码只适合私人原型，不是面向敏感数据的完整身份验证。实际使用前应采用独立用户身份与访问控制。

## 隐私说明

这个仓库是从原项目整理出的公开演示版：没有真实家庭记录、现用密码、线上 API 地址或部署凭据。图像为项目展示素材。
