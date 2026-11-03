import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "用户名至少 3 个字符")
  .max(32, "用户名最多 32 个字符")
  .regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符");

export const emailSchema = z
  .string()
  .trim()
  .email("请输入有效的邮箱地址")
  .max(254, "邮箱过长")
  .transform((value) => value.toLowerCase());

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "请输入显示名")
  .max(50, "显示名最多 50 个字符");

export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 个字符")
  .max(128, "密码最多 128 个字符");

export const setupSchema = z
  .object({
    siteName: z.string().trim().min(1).max(50).default("Kanban"),
    username: usernameSchema,
    email: emailSchema,
    displayName: displayNameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  login: z.string().trim().min(1, "请输入用户名或邮箱").max(254),
  password: z.string().min(1, "请输入密码").max(128),
  from: z.string().optional(),
});

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    displayName: displayNameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次输入的新密码不一致",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
});

export function safeFrom(from: string | null | undefined): string {
  if (!from) return "/projects";
  if (!from.startsWith("/") || from.startsWith("//")) return "/projects";
  return from;
}
