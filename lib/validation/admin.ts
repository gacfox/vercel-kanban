import { z } from "zod";
import {
  displayNameSchema,
  emailSchema,
  passwordSchema,
  usernameSchema,
} from "@/lib/validation/auth";

export const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  role: z.enum(["admin", "user"]).default("user"),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "user"]),
});

export const updateUserStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "disabled"]),
});

export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: passwordSchema,
});

export const deleteUserSchema = z.object({
  userId: z.string().uuid(),
});

export const updateSiteSettingsSchema = z.object({
  siteName: z.string().trim().min(1, "请输入站点名称").max(50),
  allowRegistration: z.preprocess(
    (value) => value === true || value === "true" || value === "on",
    z.boolean()
  ),
});
