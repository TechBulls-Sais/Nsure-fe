import React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import "./select.css";

/** Shared styled select. Native option children keep existing fixture lists readable. */
export default function Select({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  className = "",
  ...triggerProps
}) {
  const options = React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((option) => ({
      value: String(option.props.value ?? option.props.children),
      label: option.props.children,
      disabled: option.props.disabled,
    }));
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={
        defaultValue ?? (value === undefined ? options[0]?.value : undefined)
      }
      name={name}
      required={required}
      disabled={disabled}
      onValueChange={(next) =>
        onChange?.({
          target: { value: next, name },
          currentTarget: { value: next, name },
        })
      }
    >
      <SelectPrimitive.Trigger
        {...triggerProps}
        className={"ns-select-trigger " + className}
        data-nsure-select-trigger=""
        type="button"
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon className="ns-select-chevron">
          <ChevronDown size={16} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="ns-select-content"
          data-nsure-select-popup=""
          position="popper"
          side="bottom"
          sideOffset={7}
          align="start"
          collisionPadding={12}
          avoidCollisions
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <SelectPrimitive.ScrollUpButton
            className="ns-select-scroll"
            aria-label="Scroll options up"
          >
            <ChevronUp size={14} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="ns-select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                className="ns-select-item"
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ns-select-check">
                  <Check size={15} strokeWidth={2.1} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton
            className="ns-select-scroll"
            aria-label="Scroll options down"
          >
            <ChevronDown size={14} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
