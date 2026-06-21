const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://quantlens-ai.onrender.com/api/v1";

const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem("quantlens_token");
  const headers = {
    ...options.headers,
  };

  if (token && !options.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, config);

    if (response.status === 204) {
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.detail || "An error occurred with the network request.";
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const api = {
  // Generic HTTP helpers
  get: (endpoint, options = {}) => {
    return request(endpoint, { ...options, method: "GET" });
  },

  post: (endpoint, body, options = {}) => {
    return request(endpoint, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put: (endpoint, body, options = {}) => {
    return request(endpoint, {
      ...options,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete: (endpoint, options = {}) => {
    return request(endpoint, { ...options, method: "DELETE" });
  },

  // Auth
  register: (email, password, fullName) => {
    return request("/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, full_name: fullName }),
      skipAuth: true,
    });
  },

  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append("username", email); // OAuth2 password spec expects 'username'
    formData.append("password", password);

    const data = await request("/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      skipAuth: true,
    });

    if (data.access_token) {
      localStorage.setItem("quantlens_token", data.access_token);
    }
    return data;
  },

  getCurrentUser: () => {
    return request("/auth/me");
  },

  logout: () => {
    localStorage.removeItem("quantlens_token");
  },
};
