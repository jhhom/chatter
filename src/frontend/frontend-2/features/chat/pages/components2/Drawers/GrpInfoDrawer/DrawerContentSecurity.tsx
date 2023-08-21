import { clsx as cx } from "clsx";
import { PermissionSetting } from "../Permission";

export function DrawerContentSecurity(props: {
  hasPermissionToEdit: boolean;
  onBack: () => void;
}) {
  return (
    <div className="px-4 pt-6">
      <div>
        <p className="mb-3 text-sm font-medium">Group default permissions</p>

        <PermissionSetting
          name="Join (J)"
          permissionId="J"
          checked={true}
          onChange={() => {
            console.log("bom");
          }}
          editable={props.hasPermissionToEdit}
        />
        <PermissionSetting
          name="Read (R)"
          permissionId="R"
          checked={true}
          onChange={() => {
            console.log("bom");
          }}
          editable={props.hasPermissionToEdit}
        />
        <PermissionSetting
          name="Write (W)"
          permissionId="W"
          checked={true}
          onChange={() => {
            console.log("bom");
          }}
          editable={props.hasPermissionToEdit}
        />
        <PermissionSetting
          name="Get notified (P)"
          permissionId="P"
          checked={true}
          onChange={() => {
            console.log("bom");
          }}
          editable={props.hasPermissionToEdit}
        />
        <PermissionSetting
          name="Share (S)"
          permissionId="P"
          checked={true}
          onChange={() => {
            console.log("bom");
          }}
          editable={props.hasPermissionToEdit}
        />
        <PermissionSetting
          name="Delete (D)"
          permissionId="P"
          checked={true}
          onChange={() => {
            console.log("bom");
          }}
          editable={props.hasPermissionToEdit}
        />
        <PermissionSetting
          name="Administer (A)"
          permissionId="P"
          checked={true}
          onChange={() => {
            console.log("bom");
          }}
          editable={props.hasPermissionToEdit}
        />
      </div>

      <div className="text-sm">
        <p className="mb-3 mt-9 font-medium">Permissions given to you:</p>
        <p className="">JRWPSDA</p>
      </div>

      <div className="mt-8 flex justify-between text-sm">
        <button
          onClick={props.onBack}
          className={cx("rounded-md border-2 border-gray-200 px-4 py-1.5", {
            "ml-auto": !props.hasPermissionToEdit,
          })}
        >
          {props.hasPermissionToEdit ? "Cancel" : "Back"}
        </button>

        {props.hasPermissionToEdit && (
          <button className="rounded-md bg-green-600 px-4 py-1.5 font-medium text-white">
            Save changes
          </button>
        )}
      </div>
    </div>
  );
}
