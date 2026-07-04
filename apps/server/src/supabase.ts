const store: Record<string, any[]> = {};

export const db = {
  table(name: string) {
    if (!store[name]) store[name] = [];
    return store[name];
  },
  insert(table: string, row: any) {
    if (!store[table]) store[table] = [];
    store[table].push(row);
    return row;
  },
  find(table: string, key: string, val: any) {
    return (store[table] || []).filter((r: any) => r[key] === val);
  },
  findOne(table: string, key: string, val: any) {
    return (store[table] || []).find((r: any) => r[key] === val) || null;
  },
};
