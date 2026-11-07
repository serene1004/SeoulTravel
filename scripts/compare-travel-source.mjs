function indexById(records, label) {
  const indexed = new Map();
  for (const record of records) {
    if (!record.id || indexed.has(record.id)) {
      throw new Error(`${label} contains a missing or duplicate attraction id: ${record.id ?? ''}`);
    }
    indexed.set(record.id, record);
  }
  return indexed;
}

export function compareAttractions(previousRecords, nextRecords) {
  const previousById = indexById(previousRecords, 'Previous source');
  const nextById = indexById(nextRecords, 'Updated source');
  const added = [];
  const removed = [];
  const changed = [];

  for (const next of nextRecords) {
    const previous = previousById.get(next.id);
    if (!previous) {
      added.push({ id: next.id, name: next.name });
      continue;
    }

    const fields = [...new Set([...Object.keys(previous), ...Object.keys(next)])]
      .filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]))
      .sort();
    if (fields.length) changed.push({ id: next.id, name: next.name, fields });
  }

  for (const previous of previousRecords) {
    if (!nextById.has(previous.id)) removed.push({ id: previous.id, name: previous.name });
  }

  const sortById = (left, right) => left.id.localeCompare(right.id, 'en');
  return {
    added: added.sort(sortById),
    changed: changed.sort(sortById),
    removed: removed.sort(sortById),
  };
}
