// Hooks y utilidades principales de TanStack Table
import {
  useReactTable, // Hook que crea la instancia de la tabla
  getCoreRowModel, // Modelo base de filas (sin filtros ni paginación)
  flexRender, // Permite renderizar contenido dinámico de columnas
  getPaginationRowModel, // Modelo de filas con paginación
  getFilteredRowModel, // Modelo de filas filtradas
  getFacetedRowModel,
  getFacetedUniqueValues,
} from "@tanstack/react-table";

// Hook de React para manejar estado
import { useEffect, useState } from "react";

// Botón reutilizable del sistema de componentes
import { Button, Input, SearchField, Select } from "@/shared";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Inbox, ListFilter } from "lucide-react";

// Componente reutilizable de tabla
// Recibe:
// - data: datos que se mostrarán
// - columns: configuración de columnas
// - onRowDoubleClick: (opcional) callback con la fila original al hacer doble click
// - hiddenColumns: array de column ids que se ocultan en la tabla pero siguen siendo filtrables
export default function DataTable({ data, columns, onRowDoubleClick, hiddenColumns = [] }) {
  // ================== ESTADO DE PAGINACIÓN ==================
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 5,
  });

  // ================== ESTADO DEL FILTRO GLOBAL ==================
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState([]);
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);

  // Visibilidad de columnas: las de hiddenColumns arrancan ocultas.
  const [columnVisibility, setColumnVisibility] = useState(() =>
    Object.fromEntries(hiddenColumns.map((id) => [id, false]))
  );

  // ================== CONFIGURACIÓN DE LA TABLA ==================
  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      pagination,
      columnFilters,
      columnVisibility,
    },

    // Función que se ejecuta cuando cambia la paginación
    onPaginationChange: setPagination,

    // Función que se ejecuta cuando cambia el filtro global
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,

    // Modelo base de filas
    getCoreRowModel: getCoreRowModel(),

    // Modelo con filtrado aplicado
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),

    // Modelo con paginación aplicada
    getPaginationRowModel: getPaginationRowModel(),
  });

  const filterableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanFilter());

  const visibleRowCount = table.getRowModel().rows.length
  const hasNoData = data.length === 0
  const isFilteredEmpty = !hasNoData && visibleRowCount === 0

  const totalPages = Math.max(1, table.getPageCount())
  const currentPage = table.getState().pagination.pageIndex + 1
  const [pageInput, setPageInput] = useState(String(currentPage))

  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  const handlePageInputChange = (event) => {
    const raw = event.target.value
    if (raw === "") {
      setPageInput("")
      return
    }
    if (!/^\d+$/.test(raw)) return
    const num = Number(raw)
    if (num < 1) return
    setPageInput(raw)
    if (num <= totalPages) {
      table.setPageIndex(num - 1)
    }
  }

  const commitPageInput = () => {
    if (pageInput === "") {
      setPageInput(String(currentPage))
      return
    }
    const num = Number(pageInput)
    if (Number.isNaN(num) || num < 1) {
      setPageInput(String(currentPage))
      return
    }
    if (num > totalPages) {
      setPageInput(String(totalPages))
      table.setPageIndex(totalPages - 1)
      return
    }
    table.setPageIndex(num - 1)
  }

  return (
    <>
    <div className="bg-surface-hover rounded-2xl shadow-(--shadow-elevation-4) p-6 mt-4 flex flex-col gap-4 border border-border animate-fade-in">
      {/* ================== TOOLBAR ================== */}
      {/* Barra superior con buscador y selector de filas */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* ================== BUSCADOR ================== */}
        {/* Filtra todas las columnas de la tabla */}
        <SearchField
          placeholder="Buscar..."
          value={globalFilter ?? ""}
          onChange={setGlobalFilter}
          variant="outlined"
          fullWidth
          className="sm:w-full sm:flex-1"
        />

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* ================== SELECTOR DE FILAS ================== */}
          {/* Permite cambiar cuántas filas se muestran por página */}
          <select
            value={table.getState().pagination.pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            aria-label="Filas por página"
            className="border border-border rounded-xl h-[var(--size-control-md)] px-3 bg-surface-hover text-text-primary cursor-pointer focus:outline-none focus:border-border-strong transition-colors hover:bg-surface-muted"
          >
            {[5, 10, 15, 20, 25, 30].map((size) => (
              <option key={size} value={size}>
                {size} Filas
              </option>
            ))}
          </select>

          {filterableColumns.length > 0 && (
            <button
              type="button"
              onClick={() => setAreFiltersVisible((visible) => !visible)}
              aria-expanded={areFiltersVisible}
              aria-controls="column-filters"
              className={`inline-flex items-center h-[var(--size-control-md)] px-4 border rounded-xl bg-surface-hover transition-colors cursor-pointer text-text-primary ${
                areFiltersVisible || columnFilters.length > 0
                  ? "border-border-strong bg-surface-muted"
                  : "border-border hover:bg-surface-muted"
              }`}
            >
              <ListFilter size={18} />
              <span className="mx-3 h-4 w-px bg-border" aria-hidden="true" />
              <span className="font-medium">Filtros</span>
              {columnFilters.length > 0 && (
                <span className="ml-2 bg-brand text-text-inverse rounded-full text-small min-w-6 text-center px-2">
                  {columnFilters.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {filterableColumns.length > 0 && (
        <div
          id="column-filters"
          aria-hidden={!areFiltersVisible}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            areFiltersVisible
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-3 pt-1">
              <p className="text-small font-heading text-text-primary">Filtros por columna</p>
              {columnFilters.length > 0 && (
                <Button
                  size="sm"
                  variant="table"
                  onClick={() => table.resetColumnFilters()}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filterableColumns.map((column) => {
                const filterVariant = column.columnDef.meta?.filterVariant ?? "text";
                const label = typeof column.columnDef.header === "string"
                  ? column.columnDef.header
                  : column.id;
                const value = column.getFilterValue() ?? "";

                if (filterVariant === "select") {
                  const options = Array.from(column.getFacetedUniqueValues().keys())
                    .filter((option) => option !== null && option !== undefined && option !== "")
                    .sort((a, b) => String(a).localeCompare(String(b), "es"))
                    .map((option) => ({ id: String(option), label: String(option) }));

                  return (
                    <Select
                      key={column.id}
                      name={`filter-${column.id}`}
                      label={label}
                      value={value}
                      options={options}
                      placeholder="Todos"
                      onChange={(event) => column.setFilterValue(event.target.value || undefined)}
                      className="w-full min-w-0"
                    />
                  );
                }

                return (
                  <Input
                    key={column.id}
                    label={label}
                    type={filterVariant === "date" ? "date" : "search"}
                    value={value}
                    onChange={(event) => column.setFilterValue(event.target.value || undefined)}
                    placeholder={filterVariant === "date" ? undefined : `Filtrar ${label.toLowerCase()}...`}
                    className="w-full min-w-0"
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================== TABLA ================== */}
      {(hasNoData || isFilteredEmpty) ? (
        <div className="bg-[var(--color-secondary-100)] rounded-2xl border-2 border-dashed border-[var(--color-secondary-400)] py-12 px-6 flex flex-col items-center gap-3">
          <span className="bg-surface-hover rounded-full w-14 h-14 flex items-center justify-center shadow-(--shadow-elevation-1)">
            <Inbox size={22} className="text-text-primary" />
          </span>
          <p className="text-medium font-medium text-text-primary">
            {hasNoData ? "Aún no hay registros." : "No se encontraron resultados."}
          </p>
          <p className="text-small text-text-secondary text-center">
            {hasNoData
              ? "Cuando agregues uno, aparecerá aquí."
              : "Intenta ajustar los filtros o la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* ================== CABECERA ================== */}
            <thead className="bg-surface-muted/60">
              {/* TanStack agrupa cabeceras automáticamente */}
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="p-3 text-left font-medium text-text-primary border-b border-border">
                      {/*
                        flexRender permite renderizar:
                        - texto
                        - JSX
                        - funciones
                        definidos en columnDef.header
                      */}
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            {/* ================== CUERPO DE LA TABLA ================== */}
            <tbody>
              {/* Filas generadas por TanStack */}
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row.original) : undefined}
                  className={`hover:bg-surface-muted/40 transition-colors ${onRowDoubleClick ? "cursor-pointer select-none" : ""}`}
                >
                  {/* Celdas visibles de cada fila */}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3 text-text-primary border-b border-border">
                      {/* Render dinámico del contenido de la celda */}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* ================== FOOTER (fuera de la card) ================== */}
    <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* ================== INFORMACIÓN ================== */}
      {/* Cantidad de registros visibles */}
      <span className="text-small text-text-secondary">
        Mostrando {visibleRowCount} de{" "}
        {table.getFilteredRowModel().rows.length} registros
      </span>

      {/* ================== CONTROLES DE PAGINACIÓN ================== */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          size="sm"
          variant="table"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          aria-label="Primera página"
        >
          <ChevronsLeft size={16} />
          Inicio
        </Button>

        <Button
          size="sm"
          variant="table"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
          Anterior
        </Button>

        <span className="text-medium text-text-secondary px-2 whitespace-nowrap">
          Página {currentPage} de {totalPages}
        </span>

        <Button
          size="sm"
          variant="table"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Página siguiente"
        >
          Siguiente
          <ChevronRight size={16} />
        </Button>

        <Button
          size="sm"
          variant="table"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          aria-label="Última página"
        >
          Final
          <ChevronsRight size={16} />
        </Button>
      </div>

      {/* ================== IR A PÁGINA ================== */}
      {/* Permite navegar directamente a una página específica */}
      <div className="flex items-center gap-2 text-small text-text-secondary">
        <span className="whitespace-nowrap">Ir a página:</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={pageInput}
          onChange={handlePageInputChange}
          onBlur={commitPageInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur()
            }
          }}
          disabled={totalPages === 1}
          aria-label="Ir a página específica"
          className="border border-border rounded-full bg-surface-hover px-3 py-1.5 w-20 text-center focus:outline-none focus:border-border-strong transition-colors"
        />
      </div>
    </div>
    </>
  );
}
