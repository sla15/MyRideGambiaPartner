
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  prefix?: string;
  error?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerClassName?: string;
  className?: string;
}

export const Input = React.memo(({
  label,
  prefix,
  error,
  leftElement,
  rightElement,
  containerClassName = '',
  className = '',
  ...props
}: InputProps) => {
  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label className="text-xs font-bold text-gray-500 uppercase ml-2 mb-1 block">
          {label}
        </label>
      )}
      <div className={`
        relative flex items-center bg-gray-100 dark:bg-[#1C1C1E] rounded-2xl overflow-hidden
        focus-within:ring-2 focus-within:ring-[#00E39A] transition-all border border-transparent
        ${error ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/10' : ''}
      `}>
        {prefix && (
           <div className="bg-gray-200 dark:bg-[#2C2C2E] self-stretch px-4 flex items-center text-gray-600 dark:text-gray-300 font-bold select-none text-lg">
              {prefix}
           </div>
        )}
        {leftElement && (
          <div className="flex items-center pointer-events-none">
            {leftElement}
          </div>
        )}
        <input
          className={`
            flex-1 bg-transparent p-4 text-lg font-medium text-gray-900 dark:text-white 
            placeholder-gray-400 focus:outline-none min-w-0
            ${className}
          `}
          {...props}
        />
        {rightElement && (
          <div className="pr-4 text-gray-400 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 ml-2 mt-1 font-medium">{error}</p>
      )}
    </div>
  );
});
