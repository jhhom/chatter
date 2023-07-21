import React, { forwardRef } from "react";
import { useTooltipTriggerState, TooltipTriggerState } from "react-stately";
import {
  mergeProps,
  useTooltip,
  useTooltipTrigger,
  TooltipTriggerProps,
  AriaTooltipProps,
} from "react-aria";
import { useObjectRef } from "@react-aria/utils";

function Tooltip({
  state,
  ...props
}: React.PropsWithChildren<AriaTooltipProps & { state: TooltipTriggerState }>) {
  let { tooltipProps } = useTooltip(props, state);

  return (
    <div
      className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-md bg-gray-700 p-1 text-xs text-white"
      {...mergeProps(props, tooltipProps)}
    >
      {props.children}
    </div>
  );
}

export const TooltipButton = forwardRef<
  HTMLButtonElement,
  React.PropsWithChildren<TooltipTriggerProps> & {
    tooltip: string;
    onClick?: () => void;
  }
>(function TooltipButton(props, forwardedRef) {
  const state = useTooltipTriggerState({
    ...props,
    delay: 300,
    closeDelay: 300,
  });

  const internalRef = React.useRef(null);
  const ref = useObjectRef(forwardedRef || internalRef);
  const { triggerProps, tooltipProps } = useTooltipTrigger(props, state, ref);

  return (
    <div className="relative">
      <button
        ref={ref}
        {...triggerProps}
        className="rounded-full p-2 hover:bg-gray-200"
        onClick={props.onClick}
      >
        {props.children}
      </button>
      {state.isOpen && (
        <Tooltip state={state} {...tooltipProps}>
          {props.tooltip}
        </Tooltip>
      )}
    </div>
  );
});
