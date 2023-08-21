export type PermissionId = "J" | "R" | "W" | "P" | "S" | "D" | "A";

export function PermissionSetting(props: {
  name: string;
  permissionId: PermissionId;
  checked: boolean;
  onChange: (id: PermissionId, checked: boolean) => void;
  editable: boolean;
}) {
  return (
    <div className="mt-2 flex justify-between text-sm accent-green-600">
      <p>{props.name}</p>
      <input
        className="cursor-pointer"
        type="checkbox"
        name="checked"
        disabled={!props.editable}
        checked={props.checked}
        onChange={(e) => props.onChange(props.permissionId, e.target.checked)}
      />
    </div>
  );
}
