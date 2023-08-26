import { useState } from "react";
import { match } from "ts-pattern";
import { IconBackArrow } from "~/frontend/frontend-2/features/common/icons";

import { TabFindContact } from "./components/TabFindContact";
import { TabNewGroup } from "./components/TabNewGroup";
import { TabByID } from "./components/TabByID";

import { clsx as cx } from "clsx";
import { useRouter } from "next/navigation";

export function SidePanelAddContacts() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"find" | "new-group" | "by-id">(
    "find"
  );
  const [search, setSearch] = useState("");

  return (
    <div className="h-[calc(100vh-4rem)] bg-white pt-4">
      <div className="flex h-9">
        <div className="pl-4">
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-gray-300 px-2 py-2 hover:bg-gray-100"
          >
            <IconBackArrow className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        <p className="flex items-center pl-3 text-lg font-medium">
          Add contacts
        </p>
      </div>

      <div className="h-[4.4rem] bg-white px-4 pb-3 pt-4">
        <div className="flex space-x-1 rounded-md border border-gray-100 bg-gray-100/60 px-1.5 py-1.5">
          <TabButton
            onClick={() => setActiveTab("find")}
            active={activeTab === "find"}
            text="Find"
          />
          <TabButton
            onClick={() => setActiveTab("new-group")}
            active={activeTab === "new-group"}
            text="New Group"
          />
          <TabButton
            onClick={() => setActiveTab("by-id")}
            active={activeTab === "by-id"}
            text="By ID"
          />
        </div>
      </div>

      <div className="h-[calc(100%-(4.4rem+2.25rem))]">
        {match(activeTab)
          .with("new-group", () => <TabNewGroup />)
          .with("find", () => (
            <div className="h-full">
              <TabFindContact search={search} setSearch={(s) => setSearch(s)} />
            </div>
          ))
          .with("by-id", () => (
            <div>
              <TabByID />
            </div>
          ))
          .exhaustive()}
      </div>
    </div>
  );
}

function TabButton(props: {
  text: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={cx("rounded-md px-3 py-1 text-sm", {
        "bg-green-200/60 text-green-600": props.active,
      })}
      onClick={props.onClick}
    >
      {props.text}
    </button>
  );
}
