import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backendAPI } from '../services/BackendAPI';
import '../styles/Auth.css';

interface SignupFormState {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  loading: boolean;
  error: string;
}

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [formState, setFormState] = useState<SignupFormState>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
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
      // Validation
      if (!formState.email || !formState.password || !formState.firstName || !formState.lastName) {
        throw new Error('All fields are required');
      }

      if (formState.password !== formState.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (formState.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const response = await backendAPI.signup(
        formState.email,
        formState.password,
        formState.firstName,
        formState.lastName
      );

      if (response.success) {
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        navigate('/');
      } else {
        setFormState(prev => ({
          ...prev,
          error: response.error || 'Signup failed',
          loading: false,
        }));
      }
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Signup failed',
        loading: false,
      }));
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Logo and Branding */}
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.svg" alt="CreativeCaller" className="w-20 h-20 mb-4" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            CreativeCaller
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
            AI-Powered Sales Dialer & Automation Platform
          </p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-6">Create Account</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                type="text"
                name="firstName"
                value={formState.firstName}
                onChange={handleInputChange}
                placeholder="First name"
                disabled={formState.loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                value={formState.lastName}
                onChange={handleInputChange}
                placeholder="Last name"
                disabled={formState.loading}
              />
            </div>
          </div>

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
              placeholder="At least 6 characters"
              disabled={formState.loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formState.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm password"
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
            {formState.loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="link-button"
            >
              Login here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
