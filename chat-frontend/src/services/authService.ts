const API_URL = 'http://localhost:8000/api/v1/auth';

export const authService = {
  async register(data: any) {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Registration failed');
    }
    return response.json();
  },

  async login(data: any) {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Login failed');
    }
    return response.json();
  },

  async refresh(refreshToken: string) {
    const response = await fetch(`${API_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      throw new Error('Session expired');
    }
    return response.json();
  },
};
