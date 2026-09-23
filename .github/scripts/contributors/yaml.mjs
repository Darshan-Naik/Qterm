/**
 * Small YAML subset for `.github/qterm-contributors.yml`.
 * Maps, lists, lists of maps, scalars, quotes, inline arrays, and comments.
 * Indentation is spaces only.
 */

export function parseSimpleYaml(source) {
  const lines = [];
  const rawLines = String(source).split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (/^\s*$/.test(raw) || /^\s*#/.test(raw)) continue;
    if (raw.includes("\t")) {
      throw new Error(`Tabs are not allowed in contributor config (line ${i + 1})`);
    }
    const indent = raw.match(/^ */)[0].length;
    lines.push({ indent, text: raw.trim(), line: i + 1 });
  }

  const root = {};
  const stack = [{ indent: -1, container: root, kind: "map" }];

  function current() {
    return stack[stack.length - 1];
  }

  function parseScalar(text, lineNo) {
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    if (text.startsWith("[") && text.endsWith("]")) {
      const inner = text.slice(1, -1).trim();
      if (!inner) return [];
      return splitInlineList(inner).map((part) => parseScalar(part.trim(), lineNo));
    }
    if (text === "true") return true;
    if (text === "false") return false;
    if (text === "null" || text === "~") return null;
    if (/^-?\d+$/.test(text)) return Number(text);
    if (text.startsWith('"') || text.startsWith("'") || text.startsWith("[") || text.startsWith("{")) {
      throw new Error(`Unsupported value at line ${lineNo}: ${text}`);
    }
    return text;
  }

  for (let i = 0; i < lines.length; i++) {
    const { indent, text, line } = lines[i];
    while (stack.length > 1 && indent <= current().indent) stack.pop();
    const parent = current();

    if (text.startsWith("- ")) {
      if (parent.kind !== "list") {
        throw new Error(`List item is not inside a list (line ${line})`);
      }
      const rest = text.slice(2).trim();
      const embedded = splitKey(rest);
      if (embedded && !rest.startsWith('"') && !rest.startsWith("'") && !rest.startsWith("[")) {
        const obj = {};
        parent.container.push(obj);
        if (embedded.valueText === "") {
          const next = lines[i + 1];
          const child = next && next.indent > indent && next.text.startsWith("- ") ? [] : {};
          obj[embedded.key] = child;
          stack.push({ indent, container: obj, kind: "map" });
          stack.push({
            indent: indent + 1,
            container: child,
            kind: Array.isArray(child) ? "list" : "map",
          });
        } else {
          obj[embedded.key] = parseScalar(embedded.valueText, line);
          stack.push({ indent, container: obj, kind: "map" });
        }
      } else {
        parent.container.push(parseScalar(rest, line));
      }
      continue;
    }

    const keyed = splitKey(text);
    if (!keyed) throw new Error(`Expected a key (line ${line})`);
    if (parent.kind !== "map") throw new Error(`Key is not inside a map (line ${line})`);

    if (keyed.valueText === "") {
      const next = lines[i + 1];
      const child = next && next.indent > indent && next.text.startsWith("- ") ? [] : {};
      parent.container[keyed.key] = child;
      stack.push({
        indent,
        container: child,
        kind: Array.isArray(child) ? "list" : "map",
      });
    } else {
      parent.container[keyed.key] = parseScalar(keyed.valueText, line);
    }
  }

  return root;
}

function splitKey(text) {
  const colon = text.indexOf(":");
  if (colon === -1) return null;
  const key = text.slice(0, colon).trim();
  if (!key) return null;
  return { key, valueText: text.slice(colon + 1).trim() };
}

function splitInlineList(inner) {
  const parts = [];
  let current = "";
  let quote = "";
  for (const char of inner) {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}
