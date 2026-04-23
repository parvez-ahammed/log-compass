import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store/useAppStore";

export function Controls() {
  const {
    options,
    setOptions,
    ignoreKeysInput,
    setIgnoreKeysInput,
    wordDiff,
    setWordDiff,
  } = useAppStore();

  const onIgnoreKeysChange = (s: string) => {
    setIgnoreKeysInput(s);
    const keys = s
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    setOptions({ ignoreKeys: keys });
  };

  return (
    <Card className="p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        Comparison options
      </div>
      <div className="flex flex-col gap-2">
        <Toggle
          id="sortKeys"
          label="Sort keys"
          checked={options.sortKeys}
          onChange={(v) => setOptions({ sortKeys: v })}
        />
        <Toggle
          id="wordDiff"
          label="Highlight word changes"
          checked={wordDiff}
          onChange={setWordDiff}
        />
        <Toggle
          id="ignoreOrdering"
          label="Ignore array order"
          checked={options.ignoreOrdering}
          onChange={(v) => setOptions({ ignoreOrdering: v })}
        />
        <Toggle
          id="ignoreNulls"
          label="Ignore null/undef"
          checked={options.ignoreNulls}
          onChange={(v) => setOptions({ ignoreNulls: v })}
        />
        <Toggle
          id="stripTimestamps"
          label="Strip timestamps"
          checked={options.stripTimestamps}
          onChange={(v) => setOptions({ stripTimestamps: v })}
        />
        <Toggle
          id="stripIds"
          label="Strip ids"
          checked={options.stripIds}
          onChange={(v) => setOptions({ stripIds: v })}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor="ignoreKeys" className="text-xs">
            Ignore keys (comma)
          </Label>
          <Input
            id="ignoreKeys"
            value={ignoreKeysInput}
            placeholder="e.g. requestId, sessionId"
            onChange={(e) => onIgnoreKeysChange(e.target.value)}
            className="h-8 text-xs mono"
          />
        </div>
      </div>
    </Card>
  );
}

interface ToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ id, label, checked, onChange }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 cursor-pointer hover:bg-muted/60 transition-colors"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <span className="text-xs">{label}</span>
    </label>
  );
}
