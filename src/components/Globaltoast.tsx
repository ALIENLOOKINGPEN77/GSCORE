import React from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';

interface GlobalToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

/**
 * GlobalToast Component
 * 
 * A reusable toast notification component that displays success or error messages.
 * 
 * @param message - The message to display in the toast
 * @param type - The type of toast: 'success' (green) or 'error' (red)
 * @param onClose - Callback function to close the toast
 * 
 * @example
 * <GlobalToast 
 *   message="Operation completed successfully" 
 *   type="success" 
 *   onClose={() => setToast(null)} 
 * />
 */
export const GlobalToast: React.FC<GlobalToastProps> = ({ message, type, onClose }) => {
  const isSuccess = type === 'success';
  
  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div 
        className={`rounded-lg shadow-lg p-4 flex items-center gap-3 ${
          isSuccess 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}
      >
        {isSuccess ? (
          <CheckCircle className="text-green-600" size={20} />
        ) : (
          <AlertCircle className="text-red-600" size={20} />
        )}
        <span 
          className={`font-medium ${
            isSuccess ? 'text-green-800' : 'text-red-800'
          }`}
        >
          {message}
        </span>
        <button 
          onClick={onClose} 
          className="ml-2 hover:bg-gray-200 rounded p-1 transition-colors"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default GlobalToast;