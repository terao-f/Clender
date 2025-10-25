import React, { useState, useEffect, ReactNode } from 'react';
import { sanitizeInput, isValidEmail, isValidPhone, isValidEmployeeId, validatePassword, analyzeThreat } from '../utils/security';
import { useSecurity } from '../contexts/SecurityContext';

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
  sanitize?: boolean;
}

interface SecureFormProps {
  children: ReactNode;
  onSubmit: (data: Record<string, string>) => void | Promise<void>;
  onValidationError?: (errors: Record<string, string>) => void;
  className?: string;
  enableThreatDetection?: boolean;
}

interface FormField {
  name: string;
  value: string;
  rules: ValidationRule;
  error?: string;
  touched: boolean;
}

/**
 * Secure form component with built-in validation and sanitization
 */
export default function SecureForm({
  children,
  onSubmit,
  onValidationError,
  className = '',
  enableThreatDetection = true,
}: SecureFormProps) {
  const { logSecurityEvent } = useSecurity();
  const [fields, setFields] = useState<Record<string, FormField>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Register a field with validation rules
  const registerField = (name: string, rules: ValidationRule = {}) => {
    setFields(prev => ({
      ...prev,
      [name]: {
        name,
        value: '',
        rules,
        touched: false,
      },
    }));
  };

  // Update field value with validation
  const updateField = (name: string, value: string) => {
    setFields(prev => {
      const field = prev[name];
      if (!field) return prev;

      // Sanitize input if enabled
      const sanitizedValue = field.rules.sanitize !== false ? sanitizeInput(value) : value;

      // Threat detection
      if (enableThreatDetection) {
        const threat = analyzeThreat(sanitizedValue, name);
        if (threat.level === 'high' || threat.level === 'critical') {
          logSecurityEvent({
            type: 'security_violation',
            action: `Potential security threat in form field: ${name}`,
            details: { field: name, threats: threat.threats, value: sanitizedValue.substring(0, 100) },
            severity: threat.level === 'critical' ? 'critical' : 'high',
          });
        }
      }

      const updatedField = {
        ...field,
        value: sanitizedValue,
        touched: true,
        error: validateField(name, sanitizedValue, field.rules),
      };

      return {
        ...prev,
        [name]: updatedField,
      };
    });
  };

  // Validate a single field
  const validateField = (name: string, value: string, rules: ValidationRule): string | undefined => {
    // Required validation
    if (rules.required && !value.trim()) {
      return 'この項目は必須です';
    }

    // Skip other validations if empty and not required
    if (!value.trim() && !rules.required) {
      return undefined;
    }

    // Length validations
    if (rules.minLength && value.length < rules.minLength) {
      return `${rules.minLength}文字以上で入力してください`;
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return `${rules.maxLength}文字以下で入力してください`;
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value)) {
      return '正しい形式で入力してください';
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) return customError;
    }

    // Field-specific validations
    switch (name) {
      case 'email':
        if (!isValidEmail(value)) {
          return '正しいメールアドレスを入力してください';
        }
        break;
      case 'phone':
        if (!isValidPhone(value)) {
          return '正しい電話番号を入力してください（例：03-1234-5678）';
        }
        break;
      case 'employeeId':
        if (!isValidEmployeeId(value)) {
          return '正しい従業員IDを入力してください（16桁の英数字）';
        }
        break;
      case 'password':
        const passwordValidation = validatePassword(value);
        if (!passwordValidation.isValid) {
          return passwordValidation.errors[0];
        }
        break;
    }

    return undefined;
  };

  // Validate all fields
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    Object.values(fields).forEach(field => {
      const error = validateField(field.name, field.value, field.rules);
      if (error) {
        errors[field.name] = error;
        isValid = false;
      }
    });

    setFormErrors(errors);
    if (onValidationError && !isValid) {
      onValidationError(errors);
    }

    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Mark all fields as touched
      setFields(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = { ...updated[key], touched: true };
        });
        return updated;
      });

      // Validate form
      if (!validateForm()) {
        logSecurityEvent({
          type: 'data_modification',
          action: 'Form submission failed validation',
          severity: 'low',
        });
        return;
      }

      // Prepare sanitized data
      const formData: Record<string, string> = {};
      Object.values(fields).forEach(field => {
        formData[field.name] = field.value;
      });

      // Log successful form submission
      logSecurityEvent({
        type: 'data_modification',
        action: 'Form submitted successfully',
        details: { fields: Object.keys(formData) },
        severity: 'low',
      });

      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
      logSecurityEvent({
        type: 'security_violation',
        action: 'Form submission error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'medium',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Provide form context to children
  const formContext = {
    registerField,
    updateField,
    fields,
    formErrors,
    isSubmitting,
  };

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      <FormContext.Provider value={formContext}>
        {children}
      </FormContext.Provider>
    </form>
  );
}

// Form context for child components
const FormContext = React.createContext<{
  registerField: (name: string, rules?: ValidationRule) => void;
  updateField: (name: string, value: string) => void;
  fields: Record<string, FormField>;
  formErrors: Record<string, string>;
  isSubmitting: boolean;
} | null>(null);

// Hook to use form context
export function useSecureForm() {
  const context = React.useContext(FormContext);
  if (!context) {
    throw new Error('useSecureForm must be used within a SecureForm');
  }
  return context;
}

// Secure input component
interface SecureInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  name: string;
  label?: string;
  rules?: ValidationRule;
  helpText?: string;
  showStrength?: boolean; // For password fields
}

export function SecureInput({
  name,
  label,
  rules = {},
  helpText,
  showStrength = false,
  className = '',
  ...inputProps
}: SecureInputProps) {
  const { registerField, updateField, fields, formErrors } = useSecureForm();
  const field = fields[name];
  const error = formErrors[name];

  // Register field on mount
  React.useEffect(() => {
    registerField(name, rules);
  }, [name]);

  // Calculate password strength
  const getPasswordStrength = (password: string) => {
    if (!showStrength || inputProps.type !== 'password') return null;
    
    const validation = validatePassword(password);
    return {
      score: validation.score,
      color: validation.score < 40 ? 'bg-red-500' : validation.score < 70 ? 'bg-yellow-500' : 'bg-green-500',
      text: validation.score < 40 ? '弱い' : validation.score < 70 ? '普通' : '強い',
    };
  };

  const strength = field ? getPasswordStrength(field.value) : null;

  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {rules.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <input
        {...inputProps}
        id={name}
        name={name}
        value={field?.value || ''}
        onChange={(e) => updateField(name, e.target.value)}
        className={`
          block w-full rounded-md border-gray-300 shadow-sm 
          focus:border-blue-500 focus:ring-blue-500 sm:text-sm
          ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
      />

      {/* Password strength indicator */}
      {strength && field && field.value && (
        <div className="mt-2">
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
                style={{ width: `${strength.score}%` }}
              />
            </div>
            <span className="text-xs text-gray-600">{strength.text}</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && field?.touched && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Help text */}
      {helpText && !error && (
        <p id={`${name}-help`} className="mt-1 text-sm text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
}

// Secure textarea component
interface SecureTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  name: string;
  label?: string;
  rules?: ValidationRule;
  helpText?: string;
}

export function SecureTextarea({
  name,
  label,
  rules = {},
  helpText,
  className = '',
  ...textareaProps
}: SecureTextareaProps) {
  const { registerField, updateField, fields, formErrors } = useSecureForm();
  const field = fields[name];
  const error = formErrors[name];

  React.useEffect(() => {
    registerField(name, rules);
  }, [name]);

  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {rules.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <textarea
        {...textareaProps}
        id={name}
        name={name}
        value={field?.value || ''}
        onChange={(e) => updateField(name, e.target.value)}
        className={`
          block w-full rounded-md border-gray-300 shadow-sm 
          focus:border-blue-500 focus:ring-blue-500 sm:text-sm
          ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
      />

      {error && field?.touched && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}

      {helpText && !error && (
        <p id={`${name}-help`} className="mt-1 text-sm text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
}