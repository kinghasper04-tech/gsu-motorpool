import { forwardRef } from 'react';

export default forwardRef(function TextInput({ className = '', isFocused = false, ...props }, ref) {
    return (
        <input
            ref={ref}
            className={`border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm ${className}`}
            {...props}
        />
    );
});