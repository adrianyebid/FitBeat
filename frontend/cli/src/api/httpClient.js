import axios from 'axios';
import { config } from '../config/config.js';
import { getAccessToken } from '../utils/storage.js';

/**
 * HTTP client for API requests
 */

function normalizeApiError(error) {
  if (!error.response) {
    return {
      statusCode: 0,
      message: error.message || 'Network error',
      details: [],
    };
  }

  const { status, data } = error.response;
  
  // Handle FastAPI validation errors
  if (data?.detail) {
    if (typeof data.detail === 'string') {
      return {
        statusCode: status,
        message: data.detail,
        details: [],
      };
    }
    
    if (Array.isArray(data.detail)) {
      const details = data.detail.map(item => {
        const path = Array.isArray(item.loc) ? item.loc.join('.') : 'body';
        const msg = item.msg || 'invalid field';
        return `${path}: ${msg}`;
      });
      
      return {
        statusCode: status,
        message: 'Validation failed',
        details,
      };
    }
  }
  
  return {
    statusCode: status,
    message: data?.message || 'Unexpected error',
    details: data?.details || [],
  };
}

export async function request(path, options = {}) {
  const { auth = true, baseURL = config.authApiUrl, ...axiosOptions } = options;
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...axiosOptions.headers,
    };
    
    if (auth) {
      const token = await getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
    
    const response = await axios({
      baseURL,
      url: path,
      headers,
      ...axiosOptions,
    });
    
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function requestMusicService(path, options = {}) {
  return request(path, {
    ...options,
    baseURL: config.musicApiUrl,
    auth: false,
  });
}

// Made with Bob
