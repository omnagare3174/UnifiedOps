interface Props {
  triggerKey: number;
  color: string | null;
}

export function ScreenBlink({ triggerKey, color }: Props) {
  if (!color) return null;
  return (
    <div
      key={triggerKey}
      className="screen-blink"
      style={{ ['--blink-color' as string]: color }}
      aria-hidden="true"
    />
  );
}
