function Table({ content, module }) {
  const tables = module?.tables ?? [];
  const table = content?.tableId
    ? tables.find((item) => item.tableId === content.tableId)
    : tables[0];

  if (!table || !Array.isArray(table.rows)) return <div>Table not found</div>;

  const columns = table.columns ?? table.headers ?? [];
  const getColumnKey = (column) => (typeof column === "string" ? column : column.key);
  const getColumnLabel = (column) =>
    typeof column === "string" ? column : (column.label ?? column.key);

  return (
    <div>
      <h3>{table.title}</h3>
      <div className="overflow-x-auto">
        <table
          className="w-full table-auto border-collapse border border-neutral-300 text-left"
          aria-labelledby={`table-title-${content.tableId ?? "default"}`}
        >
          <caption id={`table-title-${content.tableId ?? "default"}`} className="sr-only">
            {table.title}
          </caption>
          <thead className="bg-surface-inset">
            <tr>
              {columns.map((column) => (
                <th
                  scope="col"
                  key={getColumnKey(column)}
                  className="border border-neutral-300 px-4 py-2 font-semibold"
                >
                  {getColumnLabel(column)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id ?? JSON.stringify(row)} className="even:bg-surface-app">
                {columns.map((column, columnIndex) => {
                  const key = getColumnKey(column);
                  const value = Array.isArray(row) ? row[columnIndex] : row[key];
                  return (
                    <td key={key} className="border border-neutral-300 px-4 py-2">
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
