import { useState } from 'react';
import { X, Plus, User } from 'lucide-react';

export default function AuthorizedPassengersInput({ passengers, onChange, error }) {
    const [currentPassenger, setCurrentPassenger] = useState('');

    const addPassenger = () => {
        if (currentPassenger.trim()) {
            const newPassengers = [...passengers, currentPassenger.trim()];
            onChange(newPassengers);
            setCurrentPassenger('');
        }
    };

    const removePassenger = (index) => {
        const newPassengers = passengers.filter((_, i) => i !== index);
        onChange(newPassengers);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addPassenger();
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                Authorized Passengers <span className="text-red-500">*</span>
            </label>

            {/* Input field for adding passengers */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={currentPassenger}
                    onChange={(e) => setCurrentPassenger(e.target.value)}
                    onKeyPress={handleKeyPress}

                    className="flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm"
                />
                <button
                    type="button"
                    onClick={addPassenger}
                    disabled={!currentPassenger.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Plus size={16} />
                    Add
                </button>
            </div>

            {/* List of added passengers */}
            {passengers.length > 0 && (
                <div className="mt-3 space-y-2">
                    <p className="text-sm text-gray-600">Added Passengers ({passengers.length}):</p>
                    <div className="space-y-2">
                        {passengers.map((passenger, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-3 py-2"
                            >
                                <div className="flex items-center gap-2">
                                    <User size={16} className="text-gray-400" />
                                    <span className="text-sm text-gray-700">{passenger}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removePassenger(index)}
                                    className="text-red-500 hover:text-red-700"
                                    title="Remove passenger"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error message */}
            {error && (
                <p className="text-sm text-red-600 mt-1">{error}</p>
            )}

            {/* Hint */}
            {passengers.length === 0 && (
                <p className={`text-sm mt-1 ${error ? 'text-red-500' : 'text-gray-500'}`}>
                    {error
                        ? 'At least one passenger is required.'
                        : 'Press Enter or click Add to add a passenger.'}
                </p>
            )}
        </div>
    );
}
