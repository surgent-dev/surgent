export async function data() {
  const path = Bun.env.MODELS_DEV_API_JSON
  if (path) {
    const file = Bun.file(path)
    if (await file.exists()) {
      return await file.text()
    }
  }
  const local = Bun.file(new URL("./models.local.json", import.meta.url))
  if (await local.exists()) {
    return await local.text()
  }
  return "{}"
}
