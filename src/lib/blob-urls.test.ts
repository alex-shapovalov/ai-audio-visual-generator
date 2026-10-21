import { afterEach, describe, expect, it, vi } from "vitest"
import { blobUrl, releaseBlobUrl } from "@/lib/blob-urls"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("blob urls", () => {
  it("reuses one url per blob so repeated renders do not leak", () => {
    const create = vi.spyOn(URL, "createObjectURL")
    const blob = new Blob(["a"])
    expect(blobUrl(blob)).toBe(blobUrl(blob))
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("gives different blobs different urls", () => {
    expect(blobUrl(new Blob(["a"]))).not.toBe(blobUrl(new Blob(["b"])))
  })

  it("revokes the url on release and creates a fresh one afterwards", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL")
    const blob = new Blob(["a"])
    const first = blobUrl(blob)

    releaseBlobUrl(blob)

    expect(revoke).toHaveBeenCalledWith(first)
    expect(blobUrl(blob)).not.toBe(first)
  })

  it("ignores a release for a blob that never had a url", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL")
    releaseBlobUrl(new Blob(["never used"]))
    expect(revoke).not.toHaveBeenCalled()
  })
})
