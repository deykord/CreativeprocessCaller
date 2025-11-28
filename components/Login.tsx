import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backendAPI } from '../services/BackendAPI';
import '../styles/Auth.css';

interface LoginFormState {
  email: string;
  password: string;
  loading: boolean;
  error: string;
}

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formState, setFormState] = useState<LoginFormState>({
    email: '',
    password: '',
    loading: false,
    error: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value,
      error: '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormState(prev => ({ ...prev, loading: true, error: '' }));

    try {
      if (!formState.email || !formState.password) {
        throw new Error('Email and password are required');
      }

      const response = await backendAPI.login(formState.email, formState.password);
      
      if (response.success) {
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        navigate('/');
      } else {
        setFormState(prev => ({
          ...prev,
          error: response.error || 'Login failed',
          loading: false,
        }));
      }
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Login failed',
        loading: false,
      }));
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Login</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formState.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              disabled={formState.loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              value={formState.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              disabled={formState.loading}
            />
          </div>

          {formState.error && (
            <div className="error-message">{formState.error}</div>
          )}

          <button
            type="submit"
            disabled={formState.loading}
            className="submit-button"
          >
            {formState.loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <p className="text-gray-500">Admin creates user accounts</p>
        </div>
      </div>
    </div>
  );
};
