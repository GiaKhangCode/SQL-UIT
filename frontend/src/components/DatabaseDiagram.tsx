import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Download, Key, Link2, Maximize2, Minimize2, Table as TableIcon } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";
import type { SchemaTable } from "../utils/parseDatabaseSchema";

type Relationship = {
  fromIndex: number;
  fromColumn: string;
  toIndex: number;
  toColumn: string;
  id: string;
};

const CARD_WIDTH = 264;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 32;
const COLUMN_GAP = 84;
const PADDING = 28;

export function DatabaseDiagram({ tables, allowDownload = true }: { tables: SchemaTable[]; allowDownload?: boolean }) {
  const { t: tr } = useLanguage("teacher");
  const arrowId = useId().replace(/:/g, "");
  const panelRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [diagramMessage, setDiagramMessage] = useState("");

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const relationships = useMemo<Relationship[]>(() => tables.flatMap((table, fromIndex) =>
    table.foreignKeys.flatMap((foreignKey, foreignKeyIndex) => foreignKey.columns.map((fromColumn, columnIndex) => {
      const toIndex = tables.findIndex((candidate) => candidate.name.toLowerCase() === foreignKey.referencedTable.toLowerCase());
      return {
        fromIndex,
        fromColumn,
        toIndex,
        toColumn: foreignKey.referencedColumns[columnIndex] || foreignKey.referencedColumns[0] || "",
        id: `${fromIndex}-${foreignKeyIndex}-${columnIndex}`,
      };
    })),
  ), [tables]);

  const layout = useMemo(() => {
    // Follow dependencies with a cycle guard so cyclic schemas remain visible.
    const rank = (index: number, visiting: Set<number>): number => {
      if (visiting.has(index)) return 0;
      const next = new Set(visiting).add(index);
      const parents = relationships.filter((edge) => edge.fromIndex === index && edge.toIndex >= 0 && edge.toIndex !== index);
      return parents.length ? Math.min(tables.length - 1, Math.max(...parents.map((edge) => rank(edge.toIndex, next) + 1))) : 0;
    };
    const heights = new Map<number, number>();
    const nodes = tables.map((table, index) => {
      const column = rank(index, new Set());
      const y = heights.get(column) ?? PADDING;
      const height = HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + 2;
      heights.set(column, y + height + 36);
      return { x: PADDING + column * (CARD_WIDTH + COLUMN_GAP), y, height };
    });
    return {
      nodes,
      width: Math.max(360, ...nodes.map((node) => node.x + CARD_WIDTH + PADDING + 24)),
      height: Math.max(220, ...nodes.map((node) => node.y + node.height + PADDING + relationships.length * 12)),
    };
  }, [tables, relationships]);

  const edges = relationships.flatMap((relationship, index) => {
    if (relationship.toIndex < 0) return [];
    const source = layout.nodes[relationship.fromIndex];
    const target = layout.nodes[relationship.toIndex];
    const sourceRow = tables[relationship.fromIndex].columns.findIndex((column) => column.name.toLowerCase() === relationship.fromColumn.toLowerCase());
    const targetRow = tables[relationship.toIndex].columns.findIndex((column) => column.name.toLowerCase() === relationship.toColumn.toLowerCase());
    if (sourceRow < 0 || targetRow < 0) return [];
    const y1 = source.y + HEADER_HEIGHT + sourceRow * ROW_HEIGHT + ROW_HEIGHT / 2 + 1;
    const y2 = target.y + HEADER_HEIGHT + targetRow * ROW_HEIGHT + ROW_HEIGHT / 2 + 1;
    const leftward = source.x > target.x;
    const x1 = source.x + (leftward ? 0 : CARD_WIDTH);
    const x2 = target.x + (leftward || source.x === target.x ? CARD_WIDTH : 0);
    const lane = source.x === target.x
      ? x1 + 16 + (index % 3) * 8
      : (leftward ? x1 - 1 : x1 + 1) + (x2 - x1) / 2;
    return [{ id: relationship.id, x1, y1, x2, y2, direction: leftward ? -1 : 1,
      label: `${tables[relationship.fromIndex].name}.${relationship.fromColumn} → ${tables[relationship.toIndex].name}.${relationship.toColumn}`,
      path: Math.abs(source.x - target.x) > CARD_WIDTH + COLUMN_GAP
        ? `M ${x1} ${y1} H ${x1 + (leftward ? -20 : 20)} V ${layout.height - PADDING - index * 12} H ${x2 + (leftward ? 20 : -20)} V ${y2} H ${x2}`
        : source.x === target.x && y1 === y2
        ? `M ${x1} ${y1} C ${lane + 32} ${y1 - 28}, ${lane + 32} ${y2 + 28}, ${x2} ${y2}`
        : `M ${x1} ${y1} H ${lane} V ${y2} H ${x2}`,
    }];
  });

  async function toggleFullscreen() {
    const panel = panelRef.current;
    if (!panel) return;
    try {
      if (document.fullscreenElement === panel) await document.exitFullscreen();
      else await panel.requestFullscreen();
    } catch {
      setDiagramMessage(tr("Could not open fullscreen view."));
    }
  }

  async function exportPng() {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    setExporting(true);
    setDiagramMessage("");
    try {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = layout.width * scale;
      canvas.height = layout.height * scale;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.scale(scale, scale);

      const styles = getComputedStyle(panelRef.current || canvasElement);
      const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
      const surface = color("--surface", "#ffffff");
      const subtle = color("--subtle", "#f0f1f9");
      const text = color("--text", "#171831");
      const muted = color("--muted", "#626981");
      const border = color("--border", "#dce0ed");
      const borderSubtle = color("--border-subtle", "#eceefa");
      const accent = color("--accent", "#4f46c8");
      const warning = color("--warning", "#9a6700");
      const warningSubtle = color("--warning-subtle", "#fff1c2");
      const accentSubtle = color("--accent-subtle", "#efedff");
      const fontFamily = getComputedStyle(document.body).fontFamily || "monospace";

      context.fillStyle = surface;
      context.fillRect(0, 0, layout.width, layout.height);
      context.fillStyle = borderSubtle;
      for (let x = 10; x < layout.width; x += 20) {
        for (let y = 10; y < layout.height; y += 20) {
          context.beginPath();
          context.arc(x, y, 0.7, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.strokeStyle = accent;
      context.lineWidth = 1.5;
      context.globalAlpha = 0.72;
      for (const edge of edges) {
        context.stroke(new Path2D(edge.path));
        context.fillStyle = surface;
        context.beginPath();
        context.arc(edge.x1, edge.y1, 3, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.fillStyle = accent;
        context.beginPath();
        context.moveTo(edge.x2, edge.y2);
        context.lineTo(edge.x2 - edge.direction * 7, edge.y2 - 4);
        context.lineTo(edge.x2 - edge.direction * 7, edge.y2 + 4);
        context.closePath();
        context.fill();
      }
      context.globalAlpha = 1;

      tables.forEach((table, tableIndex) => {
        const node = layout.nodes[tableIndex];
        const cardHeight = HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + 2;
        context.fillStyle = surface;
        context.strokeStyle = border;
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(node.x, node.y, CARD_WIDTH, cardHeight, 8);
        context.fill();
        context.stroke();
        context.save();
        context.beginPath();
        context.roundRect(node.x, node.y, CARD_WIDTH, cardHeight, 8);
        context.clip();
        context.fillStyle = subtle;
        context.fillRect(node.x, node.y, CARD_WIDTH, HEADER_HEIGHT);
        context.strokeStyle = border;
        context.beginPath();
        context.moveTo(node.x, node.y + HEADER_HEIGHT);
        context.lineTo(node.x + CARD_WIDTH, node.y + HEADER_HEIGHT);
        context.stroke();
        context.font = `600 11px ${fontFamily}`;
        context.fillStyle = text;
        context.fillText(table.name, node.x + 34, node.y + 25, 150);
        context.font = `9px ${fontFamily}`;
        context.fillStyle = muted;
        context.textAlign = "right";
        context.fillText(`${table.columns.length} columns`, node.x + CARD_WIDTH - 12, node.y + 24);
        context.textAlign = "left";
        context.strokeStyle = accent;
        context.lineWidth = 1.5;
        context.strokeRect(node.x + 13, node.y + 13, 14, 13);
        context.beginPath();
        context.moveTo(node.x + 13, node.y + 17.5);
        context.lineTo(node.x + 27, node.y + 17.5);
        context.moveTo(node.x + 17.5, node.y + 13);
        context.lineTo(node.x + 17.5, node.y + 26);
        context.stroke();

        table.columns.forEach((column, columnIndex) => {
          const y = node.y + HEADER_HEIGHT + columnIndex * ROW_HEIGHT;
          const isPk = table.primaryKeys.some((name) => name.toLowerCase() === column.name.toLowerCase());
          const foreignKey = table.foreignKeys.find((key) => key.columns.some((name) => name.toLowerCase() === column.name.toLowerCase()));
          if (columnIndex > 0) {
            context.strokeStyle = borderSubtle;
            context.beginPath();
            context.moveTo(node.x, y);
            context.lineTo(node.x + CARD_WIDTH, y);
            context.stroke();
          }
          let x = node.x + 10;
          if (isPk) {
            context.fillStyle = warningSubtle;
            context.beginPath();
            context.roundRect(x, y + 6, 30, 20, 4);
            context.fill();
            context.fillStyle = warning;
            context.font = `600 8px ${fontFamily}`;
            context.fillText("PK", x + 7, y + 19);
            x += 34;
          }
          if (foreignKey) {
            context.fillStyle = accentSubtle;
            context.beginPath();
            context.roundRect(x, y + 6, 29, 20, 4);
            context.fill();
            context.fillStyle = accent;
            context.font = `600 8px ${fontFamily}`;
            context.fillText("FK", x + 7, y + 19);
            x += 33;
          }
          context.font = `10px ${fontFamily}`;
          context.fillStyle = text;
          context.fillText(column.name, x, y + 20, 130);
          context.font = `9px ${fontFamily}`;
          context.fillStyle = muted;
          context.textAlign = "right";
          context.fillText(column.type || tr("Unknown type"), node.x + CARD_WIDTH - 10, y + 20, 106);
          context.textAlign = "left";
        });
        context.restore();
      });

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG export failed");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "database-diagram.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDiagramMessage(tr("PNG downloaded."));
    } catch {
      setDiagramMessage(tr("Could not export the database diagram as PNG."));
    } finally {
      setExporting(false);
    }
  }

  return <section ref={panelRef} className="teacher-schema-diagram-panel" aria-label={tr("Database diagram")}>
    <header className="teacher-schema-diagram-heading">
      <div><TableIcon size={16} aria-hidden="true" /><strong><TranslatedText>{tr("Database diagram")}</TranslatedText></strong></div>
      <div className="teacher-schema-diagram-tools">
        {diagramMessage && <span className="teacher-schema-diagram-status" role="status"><TranslatedText>{diagramMessage}</TranslatedText></span>}
        <span><TranslatedText>{tr("{value0} tables · {value1} relationships", { value0: tables.length, value1: relationships.length })}</TranslatedText></span>
        <button type="button" className="teacher-schema-diagram-action" onClick={toggleFullscreen} title={tr(isFullscreen ? "Exit fullscreen" : "View fullscreen")} aria-label={tr(isFullscreen ? "Exit fullscreen" : "View fullscreen")}>
          {isFullscreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
        </button>
        {allowDownload && <button type="button" className="teacher-schema-diagram-action" onClick={exportPng} disabled={exporting} title={tr("Download PNG")} aria-label={tr("Download PNG")}>
          <Download size={15} aria-hidden="true" />
        </button>}
      </div>
    </header>
    <div className="teacher-schema-diagram-board">
      <div ref={canvasRef} className="teacher-schema-diagram-canvas" style={{ width: layout.width, height: layout.height }}>
      <svg className="teacher-schema-diagram-lines" width={layout.width} height={layout.height} aria-hidden="true">
        <defs>
          <marker id={arrowId} markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 5 2.5 L 0 5" />
          </marker>
        </defs>
        {edges.map((edge) => <g key={edge.id}><title>{edge.label}</title><path d={edge.path} markerEnd={`url(#${arrowId})`} /><circle cx={edge.x1} cy={edge.y1} r="3" /></g>)}
      </svg>
      <div className="teacher-schema-diagram-grid">
        {tables.map((table, tableIndex) => <article className="teacher-schema-diagram-table" key={`${table.name}-${tableIndex}`} data-schema-table-index={tableIndex} style={{ left: layout.nodes[tableIndex].x, top: layout.nodes[tableIndex].y, width: CARD_WIDTH }}>
          <header>
            <div><TableIcon size={14} aria-hidden="true" /><strong>{table.name}</strong></div>
            <span><TranslatedText>{tr("{value0} columns", { value0: table.columns.length })}</TranslatedText></span>
          </header>
          <div className="teacher-schema-diagram-columns">
            {table.columns.map((column) => {
              const isPk = table.primaryKeys.some((name) => name.toLowerCase() === column.name.toLowerCase());
              const foreignKey = table.foreignKeys.find((key) => key.columns.some((name) => name.toLowerCase() === column.name.toLowerCase()));
              const foreignKeyColumnIndex = foreignKey?.columns.findIndex((name) => name.toLowerCase() === column.name.toLowerCase()) ?? -1;
              const foreignKeyTarget = foreignKey ? `${foreignKey.referencedTable}.${foreignKey.referencedColumns[foreignKeyColumnIndex] || foreignKey.referencedColumns[0] || ""}` : "";
              return <div
                title={foreignKeyTarget || column.constraints || column.name}
                className={`teacher-schema-diagram-column${isPk ? " is-pk" : ""}${foreignKey ? " is-fk" : ""}`}
                key={column.name}
                data-schema-table-index={tableIndex}
                data-schema-column-name={column.name.toLowerCase()}
              >
                <div className="teacher-schema-diagram-column-name">
                  {isPk && <span className="teacher-schema-key-badge is-pk" title={tr("Primary key (PK)")}><Key size={10} aria-hidden="true" /> PK</span>}
                  {foreignKey && <span className="teacher-schema-key-badge is-fk" title={tr("Foreign key (FK)")}><Link2 size={10} aria-hidden="true" /> FK</span>}
                  <strong>{column.name}</strong>
                </div>
                <span className="teacher-schema-diagram-type"><TranslatedText>{column.type || tr("Unknown type")}</TranslatedText></span>
              </div>;
            })}
          </div>
        </article>)}
      </div>
      </div>
    </div>
  </section>;
}
