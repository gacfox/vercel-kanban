"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/projects/settings/general-settings";
import { MembersSettings } from "@/components/projects/settings/members-settings";
import { ColumnsSettings } from "@/components/projects/settings/columns-settings";
import { FieldsSettings } from "@/components/projects/settings/fields-settings";
import { LabelsSettings } from "@/components/projects/settings/labels-settings";
import { AutomationSettings } from "@/components/projects/settings/automation-settings";
import type {
  Automation,
  AutomationRun,
} from "@/lib/db/queries/automations";
import type { ProjectSettingsData, UserSummary } from "@/lib/types";

const TABS = ["general", "members", "columns", "fields", "labels", "automation"];

export function ProjectSettings({
  data,
  allUsers,
  automations,
  runs,
  defaultTab,
}: {
  data: ProjectSettingsData;
  allUsers: Array<UserSummary & { email: string }>;
  automations: Automation[];
  runs: AutomationRun[];
  defaultTab?: string;
}) {
  const archived = Boolean(data.project.archivedAt);
  const initialTab = defaultTab && TABS.includes(defaultTab) ? defaultTab : "general";

  return (
    <Tabs defaultValue={initialTab} className="space-y-6">
      <TabsList className="flex h-auto w-full flex-wrap justify-start">
        <TabsTrigger value="general">常规</TabsTrigger>
        <TabsTrigger value="members">成员</TabsTrigger>
        <TabsTrigger value="columns">看板列</TabsTrigger>
        <TabsTrigger value="fields">自定义字段</TabsTrigger>
        <TabsTrigger value="labels">标签</TabsTrigger>
        <TabsTrigger value="automation">自动化</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralSettings project={data.project} canManage={data.canManage} />
      </TabsContent>

      <TabsContent value="members">
        <MembersSettings
          projectId={data.project.id}
          members={data.members}
          allUsers={allUsers}
          canManage={data.canManage}
          archived={archived}
        />
      </TabsContent>

      <TabsContent value="columns">
        <ColumnsSettings
          projectId={data.project.id}
          columns={data.columns}
          canManage={data.canManage}
          archived={archived}
        />
      </TabsContent>

      <TabsContent value="fields">
        <FieldsSettings
          projectId={data.project.id}
          fields={data.fields}
          canManage={data.canManage}
          archived={archived}
        />
      </TabsContent>

      <TabsContent value="labels">
        <LabelsSettings
          projectId={data.project.id}
          labels={data.labels}
          canManage={data.canManage}
          archived={archived}
        />
      </TabsContent>

      <TabsContent value="automation">
        <AutomationSettings
          projectId={data.project.id}
          automations={automations}
          runs={runs}
          columns={data.columns}
          labels={data.labels}
          fields={data.fields}
          members={data.members}
          canManage={data.canManage}
          archived={archived}
        />
      </TabsContent>
    </Tabs>
  );
}
