# 轻看板 · vercel-kanban

一个面向个人或迷你小团队的轻量级看板工具，类似 Trello / Planka。基于 Next.js 16 + React 19 + TypeScript + Tailwind CSS + shadcn/ui，可部署在 Vercel Hobby，数据存储在 Neon Postgres。

## 功能

- 首次部署 `/setup` 创建管理员
- 多用户、项目级权限（owner / editor / viewer）
- 项目、看板列、卡片拖拽排序
- 列 WIP 上限、列历史显示窗口（例如 Done 列最近 30 天）
- 标签、负责人、优先级、截止时间
- 9 种自定义字段（文本、长文本、数字、日期、单选、多选、复选框、URL、成员）
- 评论、活动记录、归档/恢复
- 核心自动化规则（事件触发 + 每日 cron）
- 亮色 / 暗色 / 跟随系统主题
- 响应式布局，移动端可用
- 注册开关、管理员用户管理、强制首次改密

## 技术栈

- Next.js 16.4 App Router、Server Components、Server Actions
- React 19、TypeScript strict
- Tailwind CSS v4、shadcn/ui、lucide-react、next-themes
- Neon Postgres（`@neondatabase/serverless` HTTP）
- Upstash Redis（登录限流、cron 互斥，可选）
- `@dnd-kit`、zod、date-fns、react-markdown、sonner

## 本地开发

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。首次访问会跳转 `/setup`。

### 环境变量

复制 `.env.example` 为 `.env.development.local`（或 `.env.local`），填入：

- `DATABASE_URL`：Neon Postgres 连接串（Vercel Storage 集成也会提供 `POSTGRES_URL`）
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`：Upstash Redis（可选）
- `CRON_SECRET`：生产环境 cron 鉴权

本地开发时 Next.js 会加载 `.env.development.local`；`next build` 需要 `.env.local` 或进程环境变量。

### 脚本

```bash
npm run dev        # 开发
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # 生产构建
npm run start      # 生产启动
```

## 首次部署

1. 在 Vercel 连接 Neon / Upstash，配置环境变量。
2. 配置 `CRON_SECRET`。
3. Deploy。
4. 访问生产域名，首次请求自动建表。
5. 在 `/setup` 创建管理员。
6. 在 `/admin/settings` 配置站点名称和注册开关。
7. 在 `/admin/users` 创建团队成员。

数据库表由 `lib/db/migrate.ts` 在首次请求时自动创建，无需手动执行 SQL。

## 自动化 Cron

`vercel.json` 配置了每日任务：

```json
{ "crons": [{ "path": "/api/cron/automations", "schedule": "0 0 * * *" }] }
```

- 每天 00:00 UTC（北京时间 08:00）执行
- Vercel Hobby 每天最多一次
- 需要 `CRON_SECRET`，Vercel Cron 会发送 `Authorization: Bearer <CRON_SECRET>`
- 事件类自动化仍然是即时执行

手动测试：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/automations
```

## 数据与同步

- 数据库：Neon Postgres，表前缀 `vk_`
- 会话：opaque token + Postgres，cookie `vk_session`
- 密码：Node `scrypt` 加盐哈希
- 同步：不做轮询/SSE/WebSocket；看板顶部提供“刷新”按钮，自己的操作乐观更新
- 列历史窗口：按卡片进入本列的时间计算，超窗卡片默认隐藏，按需分页 50 张

## 设计文档

设计文档位于 `.design/`（当前被 `.gitignore` 忽略）：

- `01-overview.md`
- `02-architecture.md`
- `03-data-model.md`
- `04-permissions.md`
- `05-ui-ux.md`
- `06-automation.md`
- `07-implementation.md`

## 已知限制

- 无实时协同；多人同时编辑以最后写入为准
- 不做附件上传、邮件邀请、邮件找回密码
- Vercel Hobby cron 每天一次，到期类自动化不是实时
- 单列卡片排序使用整数重编号，按单列 < 1000 张设计
- 未做 Webhook / 站内通知中心
