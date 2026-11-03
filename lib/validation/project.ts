import { z } from "zod";
import { PROJECT_COLOR_KEYS } from "@/lib/constants";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "请输入项目名称").max(100, "项目名称最多 100 个字符"),
  description: z.string().trim().max(2000, "描述最多 2000 个字符").optional().default(""),
  color: z.enum(PROJECT_COLOR_KEYS as [string, ...string[]]).default("blue"),
  template: z.enum(["default", "blank"]).default("default"),
});

export const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "请输入项目名称").max(100),
  description: z.string().trim().max(2000).optional().default(""),
  color: z.enum(PROJECT_COLOR_KEYS as [string, ...string[]]).default("blue"),
});

export const projectIdSchema = z.object({
  projectId: z.string().uuid(),
});

export const archiveProjectSchema = z.object({
  projectId: z.string().uuid(),
  archived: z.coerce.boolean(),
});

export const deleteProjectSchema = z.object({
  projectId: z.string().uuid(),
  confirmName: z.string().trim().min(1),
});

export const addMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["editor", "viewer"]).default("editor"),
});

export const updateMemberRoleSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["editor", "viewer"]),
});

export const removeMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const transferOwnerSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
});
