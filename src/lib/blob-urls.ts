const urls = new WeakMap<Blob, string>()

export const blobUrl = (blob: Blob) => {
  const existing = urls.get(blob)
  if (existing) return existing
  const created = URL.createObjectURL(blob)
  urls.set(blob, created)
  return created
}

export const releaseBlobUrl = (blob: Blob) => {
  const existing = urls.get(blob)
  if (!existing) return
  URL.revokeObjectURL(existing)
  urls.delete(blob)
}
