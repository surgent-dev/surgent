export function normalizePath(value = '/') {
  if (!value || value === '/') {
    return '/'
  }

  const normalized = `/${value}`.replace(/\/+/g, '/')

  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

export function normalizeBasePath(value = '') {
  if (!value || value === '/') {
    return ''
  }

  return normalizePath(value)
}

export function withBasePath(basePath = '', routePath = '/') {
  const normalizedBasePath = normalizeBasePath(basePath)
  const normalizedRoutePath = normalizePath(routePath)

  if (!normalizedBasePath) {
    return normalizedRoutePath
  }

  if (normalizedRoutePath === '/') {
    return normalizedBasePath
  }

  return `${normalizedBasePath}${normalizedRoutePath}`
}

export function stripBasePath(basePath = '', pathname = '/') {
  const normalizedBasePath = normalizeBasePath(basePath)
  const normalizedPathname = normalizePath(pathname)

  if (!normalizedBasePath || !normalizedPathname.startsWith(normalizedBasePath)) {
    return normalizedPathname
  }

  const stripped = normalizedPathname.slice(normalizedBasePath.length)

  return stripped ? normalizePath(stripped) : '/'
}
