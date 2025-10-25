import { Permission, UserRole, SecurityEvent } from '../types';

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .replace(/javascript:/gi, '') // Remove javascript protocols
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/script/gi, '') // Remove script tags
    .replace(/eval\(/gi, '') // Remove eval calls
    .slice(0, 10000); // Limit length
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (Japanese)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^0\d{1,4}-\d{1,4}-\d{4}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate employee ID format
 */
export function isValidEmployeeId(employeeId: string): boolean {
  const idRegex = /^[A-F0-9]{16}$/i;
  return idRegex.test(employeeId);
}

/**
 * Password strength validation
 */
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  score: number; // 0-100
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('パスワードは8文字以上である必要があります');
  } else {
    score += 20;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('大文字を含む必要があります');
  } else {
    score += 20;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('小文字を含む必要があります');
  } else {
    score += 20;
  }

  if (!/\d/.test(password)) {
    errors.push('数字を含む必要があります');
  } else {
    score += 20;
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('特殊文字を含むことを推奨します');
  } else {
    score += 20;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(score, 100),
  };
}

/**
 * Generate secure random string
 */
export function generateSecureId(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Rate limiting utility
 */
class RateLimiter {
  private attempts: Map<string, { count: number; lastAttempt: Date }> = new Map();

  check(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = new Date();
    const record = this.attempts.get(key);

    if (!record) {
      this.attempts.set(key, { count: 1, lastAttempt: now });
      return true;
    }

    const timeSinceLastAttempt = now.getTime() - record.lastAttempt.getTime();
    
    if (timeSinceLastAttempt > windowMs) {
      // Reset the window
      this.attempts.set(key, { count: 1, lastAttempt: now });
      return true;
    }

    if (record.count >= maxAttempts) {
      return false;
    }

    record.count++;
    record.lastAttempt = now;
    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  isBlocked(key: string, maxAttempts: number, windowMs: number): boolean {
    const record = this.attempts.get(key);
    if (!record) return false;

    const now = new Date();
    const timeSinceLastAttempt = now.getTime() - record.lastAttempt.getTime();
    
    return timeSinceLastAttempt <= windowMs && record.count >= maxAttempts;
  }
}

export const loginRateLimiter = new RateLimiter();

/**
 * Detect and analyze security threats
 */
export interface ThreatAnalysis {
  level: 'low' | 'medium' | 'high' | 'critical';
  threats: string[];
  recommendations: string[];
}

export function analyzeThreat(input: string, context: string = ''): ThreatAnalysis {
  const threats: string[] = [];
  const recommendations: string[] = [];
  let level: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // SQL Injection patterns
  if (/(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bDROP\b)/i.test(input)) {
    threats.push('Potential SQL injection attempt');
    level = 'high';
    recommendations.push('Use parameterized queries');
  }

  // XSS patterns
  if (/<script|javascript:|on\w+\s*=/i.test(input)) {
    threats.push('Potential XSS attempt');
    level = 'high';
    recommendations.push('Sanitize user input');
  }

  // Directory traversal
  if (/\.\.\/|\.\.\\/.test(input)) {
    threats.push('Potential directory traversal attempt');
    level = 'medium';
    recommendations.push('Validate file paths');
  }

  // Command injection
  if (/[;&|`$(){}]/.test(input)) {
    threats.push('Potential command injection attempt');
    level = 'medium';
    recommendations.push('Avoid executing user input');
  }

  // Excessive length (potential DoS)
  if (input.length > 10000) {
    threats.push('Unusually long input (potential DoS)');
    level = 'medium';
    recommendations.push('Implement input length limits');
  }

  return { level, threats, recommendations };
}

/**
 * Audit log formatting utilities
 */
export function formatSecurityEvent(event: SecurityEvent): string {
  const timestamp = event.timestamp.toISOString();
  const user = `${event.userEmail} (${event.userRole})`;
  const action = event.action;
  const resource = event.resource ? ` on ${event.resource}` : '';
  const resourceId = event.resourceId ? ` (ID: ${event.resourceId})` : '';
  
  return `[${timestamp}] ${event.severity.toUpperCase()}: ${user} - ${action}${resource}${resourceId}`;
}

/**
 * Permission requirement checking for components
 */
export function checkPermissionRequirement(
  userPermissions: Permission[],
  requiredPermissions: Permission | Permission[],
  requireAll: boolean = false
): boolean {
  const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  
  if (requireAll) {
    return required.every(permission => userPermissions.includes(permission));
  } else {
    return required.some(permission => userPermissions.includes(permission));
  }
}

/**
 * Role hierarchy checking
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  employee: 1,
  admin: 2,
  president: 3,
};

export function hasRoleLevel(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Secure data filtering based on user permissions
 */
export function filterDataByPermissions<T extends { id: string; createdBy?: string }>(
  data: T[],
  userRole: UserRole,
  userId: string,
  canViewAll: boolean
): T[] {
  if (userRole === 'president' || canViewAll) {
    return data;
  }

  // Filter to only show user's own data
  return data.filter(item => item.createdBy === userId);
}

/**
 * Session token utilities
 */
export function generateSessionToken(): string {
  return generateSecureId(64);
}

export function isValidSessionToken(token: string): boolean {
  return /^[A-Za-z0-9]{64}$/.test(token);
}

/**
 * IP address validation and logging
 */
export function getClientIP(): string {
  // In a real application, this would extract the client IP from request headers
  return 'localhost';
}

export function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'localhost';
}