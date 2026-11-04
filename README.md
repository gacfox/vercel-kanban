#  vercel-kanban 轻看板

面向个人或迷你小团队的轻量级看板工具，类似 Trello。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgacfox%2Fvercel-kanban)

## 截图

![](https://github.com/user-attachments/assets/50f89ee7-3104-4b77-8f5d-9c58c8dca253)

## 功能

- 首次部署时进入 `/setup` 页面创建管理员
- 多用户系统，用户权限按项目级维度管理，支持管理员创建用户，可配置是否允许注册
- 项目、看板列、卡片管理，卡片支持拖拽排序
- 卡片支持指定标签、负责人、优先级、截止时间，支持多种自定义字段（文本、长文本、数字、日期、单选、多选、复选框、URL、成员）
- 卡片支持评论、活动记录、归档和恢复功能
- 支持自动化规则（事件触发 + 每日 cron）
- 亮色 / 暗色主题模式

## 部署到 Vercel

1. 在 Vercel 连接 Neon、Upstash
2. 配置 `CRON_SECRET`
3. 触发执行部署

## 技术栈

**应用**：Next.js 16.4 App Router、React 19、TypeScript、Tailwind CSS v4、shadcn/ui、lucide-react、next-themes

**存储**：Neon Postgres、Upstash Redis

## 本地开发

复制 `.env.example` 为 `.env.development.local`，填入以下配置项：

- `DATABASE_URL`：Neon Postgres 连接串
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`：Upstash Redis 连接串
- `CRON_SECRET`：生产环境 cron 鉴权

注意：本地开发时 Next.js 会加载 `.env.development.local`，`next build` 需要 `.env.local` 或进程环境变量。

或者将项目 Fork 并部署到 Vercel，然后执行命令拉取配置：

```bash
npx vercel env pull .env.development.local
```

启动本地开发环境：

```bash
npm install && npm run dev
```
