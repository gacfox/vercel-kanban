import type { CustomField, UserSummary } from "@/lib/types";

export function formatFieldValue(
  field: CustomField,
  value: unknown,
  members: UserSummary[] = []
): string {
  if (value == null || value === "") return "";

  switch (field.type) {
    case "checkbox":
      return value === true ? "是" : "否";
    case "multi_select":
      return Array.isArray(value) ? value.join("、") : String(value);
    case "user": {
      const member = members.find((item) => item.id === value);
      return member?.displayName ?? "未知成员";
    }
    case "date":
      return String(value);
    case "number":
      return typeof value === "number" ? String(value) : String(value);
    default:
      return String(value);
  }
}
