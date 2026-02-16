// Authenticated fetch wrapper - automatically includes JWT token
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't override Content-Type for FormData (multipart uploads)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  return fetch(url, {
    ...options,
    headers,
  }).then(res => {
    // If token expired or invalid, redirect to login
    if (res.status === 401 || res.status === 403) {
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/') {
        localStorage.clear();
        window.location.href = '/';
      }
    }
    return res;
  });
}

// Helper for JSON requests
export function authFetchJson(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  return authFetch(url, { ...options, headers });
}
