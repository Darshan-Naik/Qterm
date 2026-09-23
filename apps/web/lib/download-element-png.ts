/** Paint a rendered card onto a canvas and download it as a PNG. */
export async function downloadElementPng(node: HTMLElement, filename: string) {
  await document.fonts.ready;
  const scale = 2;
  const width = Math.ceil(node.getBoundingClientRect().width);
  const height = Math.ceil(node.getBoundingClientRect().height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width * scale);
  canvas.height = Math.max(1, height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.scale(scale, scale);
  const root = node.getBoundingClientRect();
  await paintElement(context, node, root);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("Could not create a PNG");
  const url = URL.createObjectURL(png);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function paintElement(context: CanvasRenderingContext2D, element: Element, root: DOMRect) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const x = rect.left - root.left;
  const y = rect.top - root.top;
  const radius = Math.min(rect.width / 2, parseFloat(style.borderRadius) || 0);

  context.save();
  traceRoundRect(context, x, y, rect.width, rect.height, radius);
  context.clip();

  const background = style.backgroundColor;
  if (background && background !== "rgba(0, 0, 0, 0)" && background !== "transparent") {
    context.fillStyle = background;
    context.fillRect(x, y, rect.width, rect.height);
  }
  if (style.backgroundImage.includes("linear-gradient")) {
    drawGrid(context, x, y, rect.width, rect.height, parseFloat(style.backgroundSize) || 32);
  }

  context.restore();

  if (style.borderTopWidth !== "0px" && style.borderTopStyle !== "none") {
    context.save();
    context.strokeStyle = style.borderTopColor;
    context.lineWidth = parseFloat(style.borderTopWidth) || 1;
    traceRoundRect(context, x, y, rect.width, rect.height, radius);
    context.stroke();
    context.restore();
  }

  for (const child of element.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      if (el.tagName.toLowerCase() === "svg") await paintSvg(context, el, root);
      else await paintElement(context, el, root);
    } else if (child.nodeType === Node.TEXT_NODE && element.childElementCount === 0) {
      paintText(context, element, root);
      break;
    }
  }
}

function paintText(context: CanvasRenderingContext2D, element: Element, root: DOMRect) {
  const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const x = rect.left - root.left + padLeft;
  const y = rect.top - root.top + rect.height / 2;
  context.save();
  context.font = style.font;
  context.fillStyle = style.color;
  context.textBaseline = "middle";
  const tracking = style.letterSpacing === "normal" ? 0 : parseFloat(style.letterSpacing) || 0;
  if (!tracking) {
    context.fillText(text, x, y);
  } else {
    let cursor = x;
    for (const character of text) {
      context.fillText(character, cursor, y);
      cursor += context.measureText(character).width + tracking;
    }
  }
  context.restore();
}

async function paintSvg(context: CanvasRenderingContext2D, svg: Element, root: DOMRect) {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const markup = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = await loadImage(url);
  const rect = svg.getBoundingClientRect();
  context.drawImage(image, rect.left - root.left, rect.top - root.top, rect.width, rect.height);
}

function drawGrid(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
) {
  context.save();
  context.strokeStyle = "rgba(243, 240, 232, 0.045)";
  context.lineWidth = 1;
  context.beginPath();
  for (let line = size; line < width; line += size) {
    context.moveTo(x + line, y);
    context.lineTo(x + line, y + height);
  }
  for (let line = size; line < height; line += size) {
    context.moveTo(x, y + line);
    context.lineTo(x + width, y + line);
  }
  context.stroke();
  context.restore();
}

function traceRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not draw the Qterm logo"));
    image.src = url;
  });
}
